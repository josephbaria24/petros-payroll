//app\api\upload-avatar\route.ts
import { NextRequest, NextResponse } from "next/server";
import formidable from "formidable";
import { Readable } from "stream";
import * as ftp from "basic-ftp";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function toNodeRequest(req: NextRequest): any {
  const readable = new Readable({ read() { } });

  req.arrayBuffer().then((buffer) => {
    readable.push(Buffer.from(buffer));
    readable.push(null);
  });

  (readable as any).headers = Object.fromEntries(req.headers);
  (readable as any).method = req.method;
  (readable as any).url = req.url;

  return readable;
}

export async function POST(req: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const form = formidable({ multiples: false });
    const nodeReq = toNodeRequest(req);

    form.parse(nodeReq, async (err: any, fields: any, files: any) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        return;
      }

      // We sent 'file' from employees/page.tsx
      const imageFile = Array.isArray(files.file)
        ? files.file[0]
        : (files.file as any);

      const oldFileName = Array.isArray(fields.oldFileName)
        ? fields.oldFileName[0]
        : fields.oldFileName;

      if (!imageFile) {
        resolve(NextResponse.json({ error: "No image uploaded" }, { status: 400 }));
        return;
      }

      const client = new ftp.Client();

      try {
        await client.access({
          host: process.env.HOSTINGER_SFTP_HOST!,
          user: process.env.HOSTINGER_SFTP_USER!,
          password: process.env.HOSTINGER_SFTP_PASS!,
          port: 21,
          secure: false, // Match user's working config to avoid socket errors
        });

        // Generate unique filename
        const ext = imageFile.originalFilename?.split(".").pop()?.toLowerCase();
        const newFileName = `${randomUUID()}.${ext}`;

        // 1. Reset to FTP root to avoid relative path nesting issues
        await client.cd("/");

        // 1. Hostinger jailed users often start inside "public_html/payroll_system/"
        // Let's try to reach the target subdirectory directly from wherever we landed
        let reachedTarget = false;
        try {
          // Try to just reach "uploads" relative to the current folder (if jailed)
          await client.ensureDir("payroll_system");
          reachedTarget = true;
        } catch (e) {
          // If that failed, reset to absolute root and try the full path
          try {
            await client.cd("/");
            await client.ensureDir("public_html/payroll_system/uploads");
            reachedTarget = true;
          } catch (e2) {
            // Last resort: just try root
            await client.cd("/");
          }
        }

        // 3. Handle old file removal if reachable
        if (oldFileName && typeof oldFileName === 'string') {
          try {
            // oldFileName was likely a full path or just a name from previous iterations
            const oldFileBase = oldFileName.split('/').pop() || oldFileName;
            await client.remove(oldFileBase);
          } catch (e) { }
        }

        // 4. Upload the file using JUST the filename (since we are now in the correct dir)
        await client.uploadFrom(imageFile.filepath, newFileName);

        client.close();

        // Based on the provided path, the web route should be:
        const publicUrl = `https://petrosphere.com.ph/payroll_system/uploads/payroll_system/${newFileName}`;

        // Sync with Supabase if employeeId is provided
        const employeeId = fields.employeeId?.[0] || fields.employeeId;
        const org = fields.org?.[0] || fields.org;

        if (employeeId && publicUrl) {
          const table = org === "pdn" ? "pdn_employees" : "employees";
          const { error: dbError } = await supabaseServer
            .from(table)
            .update({ profile_picture_url: publicUrl })
            .eq("id", employeeId);

          if (dbError) {
            console.error("Supabase update error:", dbError);
          }
        }

        resolve(NextResponse.json({ url: publicUrl }));
      } catch (uploadErr: any) {
        console.error(uploadErr)
        resolve(NextResponse.json({ error: uploadErr.message }, { status: 500 }));
      }
    });
  });
}
