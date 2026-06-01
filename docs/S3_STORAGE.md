# S3 storage (Launch & Training)

Launch & Training uploads use `StorageService` (`src/storage/storage.service.ts`).

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

## Object keys

```
uploads/companyproject/launchAndTraining/{projectId}/launch-session-{timestamp}-{random}.{ext}
```

MongoDB stores the **key** (not a Render URL). API responses expose `document_url` as the CloudFront URL when `AWS_CLOUDFRONT_URL` is set.

## AWS (DevOps)

- Bucket `greenco-dev` is private.
- CloudFront distribution must use **Origin Access Control (OAC)** and an S3 bucket policy allowing `s3:GetObject` for that distribution.

## Verify upload

```bash
aws s3 ls s3://greenco-dev/uploads/companyproject/launchAndTraining/<projectId>/
```

## Local dev without AWS

If AWS variables are omitted, files are written under `uploads/` on disk and URLs use `API_BASE_URL`.
