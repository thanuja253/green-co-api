# S3 storage

File uploads use `S3Service` (`src/s3/s3.service.ts`).

Launch & Training and other flows call `S3Service` directly from domain services. Generic HTTP helpers live under `/s3/*` (`S3Controller`).

## Render environment variables

Set on **every** API service (`green-co-api-04z5`, `green-co-api-admin`, etc.):

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<IAM user with s3:PutObject + s3:GetObject on greenco-dev/uploads/*>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_S3_BUCKET=greenco-dev
AWS_CLOUDFRONT_URL=https://d28zeq7uxkkyjq.cloudfront.net
```

Redeploy after adding variables.

## Launch & Training object keys

```
uploads/companyproject/launchAndTraining/{projectId}/launch-session-{timestamp}-{random}.{ext}
```

MongoDB stores the **key** (not a Render URL). API responses expose `document_url` as the CloudFront URL when `AWS_CLOUDFRONT_URL` is set.

## Generic S3 HTTP API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/s3/upload` | Multipart upload via API |
| POST | `/s3/presigned-upload` | Presigned PUT URL + key |
| GET | `/s3/download-url?key=` | Presigned GET URL |
| GET | `/s3/list?prefix=` | List objects |
| DELETE | `/s3?key=` | Delete object |

## AWS (DevOps)

- Bucket `greenco-dev` is private.
- CloudFront distribution must use **Origin Access Control (OAC)** and an S3 bucket policy allowing `s3:GetObject` for that distribution.

## Verify upload

```bash
aws s3 ls s3://greenco-dev/uploads/companyproject/launchAndTraining/<projectId>/
```

## Local dev without AWS

If AWS variables are omitted, files are written under `uploads/` on disk and URLs use `API_BASE_URL`.
