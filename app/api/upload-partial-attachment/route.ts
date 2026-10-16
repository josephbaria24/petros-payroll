import { NextRequest, NextResponse } from "next/server"
import formidable from "formidable"
import { Readable } from "stream"
import * as ftp from "basic-ftp"
import { randomUUID } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

type UploadedAttachment = {
  name: string
  url: string
  uploaded_at: string
}

function toNodeRequest(req: NextRequest): any {
  const readable = new Readable({ read() {} })

  req.arrayBuffer().then((buffer) => {
    readable.push(Buffer.from(buffer))
    readable.push(null)
  })

  ;(readable as any).headers = Object.fromEntries(req.headers)
  ;(readable as any).method = req.method
  ;(readable as any).url = req.url

  return readable
}

export async function POST(req: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const form = formidable({ multiples: true, maxFileSize: 15 * 1024 * 1024 })
    const nodeReq = toNodeRequest(req)

    form.parse(nodeReq, async (err: any, _fields: any, files: any) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }))
        return
      }

      const raw = files.files ?? files.file
      const fileList: any[] = !raw ? [] : Array.isArray(raw) ? raw : [raw]

      if (fileList.length === 0) {
        resolve(NextResponse.json({ error: "No files uploaded" }, { status: 400 }))
        return
      }

      const client = new ftp.Client()
      const uploaded: UploadedAttachment[] = []

      try {
        await client.access({
          host: process.env.HOSTINGER_SFTP_HOST!,
          user: process.env.HOSTINGER_SFTP_USER!,
          password: process.env.HOSTINGER_SFTP_PASS!,
          port: 21,
          secure: false,
        })

        // Same directory pattern as avatar uploads
        await client.cd("/")
        try {
          await client.ensureDir("payroll_system")
        } catch {
          try {
            await client.cd("/")
            await client.ensureDir("public_html/payroll_system/uploads")
          } catch {
            await client.cd("/")
          }
        }

        for (const file of fileList) {
          const original = (file.originalFilename || "attachment").replace(/[^\w.\-()+ ]+/g, "_")
          const ext = original.includes(".") ? original.split(".").pop()?.toLowerCase() : "bin"
          const newFileName = `partial_${randomUUID()}.${ext}`

          await client.uploadFrom(file.filepath, newFileName)

          uploaded.push({
            name: original,
            url: `https://petrosphere.com.ph/payroll_system/uploads/payroll_system/${newFileName}`,
            uploaded_at: new Date().toISOString(),
          })
        }

        client.close()
        resolve(NextResponse.json({ files: uploaded }))
      } catch (uploadErr: any) {
        console.error(uploadErr)
        try {
          client.close()
        } catch {
          /* ignore */
        }
        resolve(NextResponse.json({ error: uploadErr.message || "Upload failed" }, { status: 500 }))
      }
    })
  })
}
