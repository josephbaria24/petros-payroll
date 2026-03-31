//app\api\upload-avatar\route.ts
import { NextRequest, NextResponse } from "next/server";
import { IncomingForm, Files, Fields } from "formidable";
import { Readable } from "stream";
import * as ftp from "basic-ftp";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function toNodeRequest(req: NextRequest): any {
  const readable = new Readable({ read() {} });

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
    const form = new IncomingForm({ multiples: false });
    const nodeReq = toNodeRequest(req);

    form.parse(nodeReq, async (err: any, fields: Fields, files: Files) => {
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

        // Attempt to create an avatars directory if the FTP user root allows it
        // Or if the FTP is jailed to public_html, we can use avatars directly.
        // Assuming we want to drop it in public_html/avatars or just avatars
        const targetDir = "public_html/avatars"
        
        try {
          await client.ensureDir(targetDir)
        } catch (dirErr) {
          console.log("Could not ensure dir public_html/avatars, attempting just 'avatars' or root", dirErr)
          // If we can't create it, we might be jailed to a specific folder, let's try 'avatars'
          try {
             await client.ensureDir("avatars")
          } catch(e) { }
        }

        if (oldFileName && typeof oldFileName === 'string') {
          try {
            await client.remove(oldFileName)
          } catch (e) { }
        }

        // Identify the best path for Hostinger based on common setups
        const pathsToTry = [
          `public_html/avatars/${newFileName}`,
          `domains/petrosphere.com.ph/public_html/avatars/${newFileName}`,
          `avatars/${newFileName}`,
          newFileName
        ];
        
        // Ensure standard destination exists if it happens to be the root.
        try { await client.ensureDir("public_html/avatars"); } catch (e) {}

        let uploadSuccess = false;
        let finalPathUsed = newFileName;
        for (const ftpPath of pathsToTry) {
           try {
             await client.uploadFrom(imageFile.filepath, ftpPath);
             uploadSuccess = true;
             finalPathUsed = ftpPath;
             break;
           } catch (e) {
             // Try next route
           }
        }
        
        if (!uploadSuccess) {
           throw new Error("Could not find a valid writable directory in FTP server.");
        }

        client.close();

        // The exact final public URL might vary depending on where it stuck,
        // but normally if we used `public_html/avatars/...` we can assume the web route is:
        const publicUrl = `https://petrosphere.com.ph/avatars/${newFileName}`;

        resolve(NextResponse.json({ url: publicUrl }));
      } catch (uploadErr: any) {
        console.error(uploadErr)
        resolve(NextResponse.json({ error: uploadErr.message }, { status: 500 }));
      }
    });
  });
}
