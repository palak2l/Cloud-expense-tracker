# Project report outline — Cloud-Based Expense Tracker

**Student:** Palak Lodha  
**Title:** Cloud-Based Expense Tracker  
**Stack:** HTML/CSS/JavaScript, Chart.js, Node.js, Express, SQLite, Amazon S3, EC2, Nginx, PM2, CloudWatch

## 1. Problem

Students need a private, multi-user expense ledger that is more than a static spreadsheet: authentication, live totals, budgets, and optional cloud receipt storage.

## 2. Objectives

- Build a working full-stack app (not a mock dashboard).
- Store users and transactions in SQLite with parameterized queries.
- Hash passwords with bcrypt; keep sessions in HTTP-only cookies.
- Optionally store receipts in a private S3 bucket using AWS SDK v3.
- Deploy on Ubuntu/EC2 behind Nginx with PM2 and CloudWatch monitoring.

## 3. Architecture

Browser → Nginx (80/443) → Express on `127.0.0.1:3000` (PM2) → SQLite file.  
Receipts → S3 (`STORAGE_DRIVER=s3`) or local `uploads/` for development.  
EC2 instance role supplies S3 and CloudWatch permissions (no access keys in code).

## 4. Security controls

Password hashing, CSRF tokens, login rate limits, Helmet headers, origin checks in production, user_id authorization, private S3, validated receipt types/sizes, `.env` secrets not committed.

## 5. Results

Automated tests cover auth, CSRF, per-user data isolation, budgets, receipts, and CSV export. Dashboard cards and Chart.js graphs read live `/api/dashboard/summary` data.

## 6. AWS resources to name in the submitted report

Replace after you actually create them:

- Region: `YOUR_AWS_REGION` (example: `ap-south-1`)
- EC2 instance id: `YOUR_EC2_INSTANCE_ID`
- Public DNS: `YOUR_EC2_PUBLIC_DNS_OR_DOMAIN`
- S3 bucket: `YOUR_PRIVATE_BUCKET_NAME`
- IAM role: `YOUR_EC2_INSTANCE_ROLE_NAME`

Do not paste access keys into the report.

## 7. Conclusion

The project demonstrates compute (EC2), storage (S3 + SQLite backup), and monitoring (CloudWatch) as taught in an introductory Cloud Computing course.
