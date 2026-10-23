# Cloud Expense Tracker — Made by Palak Lodha

Beginner-friendly **Cloud Computing** mini-project: a real multi-user expense tracker (HTML, CSS, vanilla JavaScript, Chart.js, Node.js, Express, SQLite, Amazon S3). Totals and charts are computed from each signed-in user’s database rows.

This repository contains the **application source**. Amazon EC2, S3, IAM, and CloudWatch exist only after **you** create them in your AWS account. Placeholders such as `YOUR_PRIVATE_BUCKET_NAME` and `YOUR_EC2_PUBLIC_DNS_OR_DOMAIN` must be replaced during deployment.

## Light and dark UI

The dashboard and login pages use a navy, violet, and teal theme. Use **Dark mode** / **Light mode** in the top bar. The choice is stored in `localStorage` (`cet-theme`) and follows the system preference on first visit.

---

## A. Folder structure and dependencies

```
Cloud-expense-tracker/
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── server.js
│   ├── app.js
│   ├── db/             schema.sql, database.js, session-store.js
│   ├── middleware/     security.js
│   ├── routes/         auth, transactions, dashboard, budgets, receipts
│   ├── services/       storage.js (local disk or S3)
│   └── utils/
├── public/             HTML, CSS, JavaScript, Chart.js (CDN)
├── tests/              node:test + supertest
├── scripts/            backup-db.js, backup.sh
├── deploy/             Nginx, PM2, IAM, CloudWatch configs
└── docs/               demo script and report outline
```

### Windows (local run)

```powershell
cd C:\Users\palak\Cloud-expense-tracker
copy .env.example .env
# Edit .env: set SESSION_SECRET to a long random string. Keep STORAGE_DRIVER=local.
node -v          # need Node.js 20+
npm install
npm test
npm start
```

Open **http://localhost:3000**

### Verification

- `GET http://localhost:3000/health` returns `{ "ok": true, "storage": "local" }`
- Login page loads; theme toggle switches light/dark
- Registering an account opens the live dashboard (not a static mock)

---

## B. Database and backend

SQLite schema: `src/db/schema.sql` (users, sessions, transactions, budgets). The file is created automatically at `DATABASE_PATH`.

All SQL uses **bound parameters** (`prepare` / `run` / `get` / `all`). Transaction, budget, and receipt routes always include `user_id` from `req.session.userId`.

### API

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/auth/csrf` | Session CSRF token |
| POST | `/api/auth/register` | bcrypt hash (cost 12) |
| POST | `/api/auth/login` | Rate limited |
| POST | `/api/auth/logout` | Destroys session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/dashboard/summary` | Totals, charts, budget warnings |
| GET/POST/PUT/DELETE | `/api/transactions` | CRUD + search filters |
| GET | `/api/transactions/export` | CSV |
| GET/PUT | `/api/budgets` | Monthly category limits |
| POST/GET/DELETE | `/api/receipts/:id` | Owner-only receipts |

---

## C. Frontend and charts

- `public/index.html` — register / log in
- `public/dashboard.html` — summary cards, Chart.js doughnut + line charts, CRUD, budgets, history, CSV
- Figures load from `/api/dashboard/summary` after login

---

## D. Authentication and security

- Passwords stored only as bcrypt hashes
- Session cookie `cet.sid`: HTTP-only, `SameSite=lax`, `Secure` when `COOKIE_SECURE=true` (HTTPS production)
- CSRF header `X-CSRF-Token` on mutating `/api` calls (except login/register)
- Login/register rate limit: 8 / 15 minutes
- Helmet security headers + production `Origin`/`Referer` check (`APP_ORIGIN`)
- Input length/type checks in `src/utils/validation.js`

Generate a production secret:

```bash
openssl rand -hex 32
```

---

## E. S3 integration

`STORAGE_DRIVER=local` writes receipts under `uploads/` (gitignored) so the app **runs without AWS**.

`STORAGE_DRIVER=s3` uses AWS SDK for JavaScript **v3** (`@aws-sdk/client-s3`) to put/get/delete objects in a **private** bucket. Keys look like `receipts/<userId>/<date>/<uuid>.ext`.

On EC2, **do not** set `AWS_ACCESS_KEY_ID` in `.env`. Attach an instance role (see phase H).

Allowed receipts: JPG, PNG, WEBP, PDF, max 5 MB (`MAX_RECEIPT_BYTES`).

Replace:

- `YOUR_PRIVATE_BUCKET_NAME`
- `YOUR_AWS_REGION` (default in examples: `ap-south-1`)

S3 has **not** been created by this project until you run the AWS commands below.

---

## F. Automated tests

```powershell
npm test
```

Coverage includes password hashing, CSRF, user isolation, dashboard math, budget warnings, receipt ownership, CSV export, and validation errors.

---

## G. EC2 deployment, Nginx, and PM2

**Not deployed until you create the instance.** Replace every `YOUR_*` value.

### 1. Launch Ubuntu EC2

- AMI: Ubuntu 24.04 LTS
- Size: t2.micro / t3.micro (Free Tier if eligible)
- Security group: see phase H
- IAM instance profile: role with S3 + CloudWatch policies
- Key pair: `YOUR_EC2_KEY_NAME`

Copy the app (from your PC):

```powershell
scp -i YOUR_EC2_KEY_NAME.pem -r C:\Users\palak\Cloud-expense-tracker ubuntu@YOUR_EC2_PUBLIC_DNS_OR_DOMAIN:~/cloud-expense-tracker
```

SSH:

```powershell
ssh -i YOUR_EC2_KEY_NAME.pem ubuntu@YOUR_EC2_PUBLIC_DNS_OR_DOMAIN
```

### 2. Install Node, Nginx, PM2

```bash
sudo apt update
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential
sudo npm install -g pm2
cd ~/cloud-expense-tracker
npm install --omit=dev
```

### 3. Production environment

```bash
sudo nano /etc/expense-tracker.env
```

```
NODE_ENV=production
PORT=3000
SESSION_SECRET=PASTE_OPENSSL_RAND_HEX_32
DATABASE_PATH=/home/ubuntu/cloud-expense-tracker/data/expense-tracker.sqlite
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
APP_ORIGIN=http://YOUR_EC2_PUBLIC_DNS_OR_DOMAIN
STORAGE_DRIVER=s3
AWS_REGION=YOUR_AWS_REGION
S3_BUCKET_NAME=YOUR_PRIVATE_BUCKET_NAME
MAX_RECEIPT_BYTES=5242880
```

When HTTPS is enabled, set `COOKIE_SECURE=true` and `APP_ORIGIN=https://YOUR_DOMAIN`.

```bash
sudo chown root:ubuntu /etc/expense-tracker.env
sudo chmod 640 /etc/expense-tracker.env
```

Edit `deploy/ecosystem.config.js` so `cwd` matches the app path, then:

```bash
cd ~/cloud-expense-tracker
set -a; source /etc/expense-tracker.env; set +a
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 4. Nginx reverse proxy

```bash
sudo cp ~/cloud-expense-tracker/deploy/nginx.conf /etc/nginx/sites-available/expense-tracker
sudo nano /etc/nginx/sites-available/expense-tracker   # set server_name
sudo ln -sf /etc/nginx/sites-available/expense-tracker /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Optional TLS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

### Verification

```bash
curl -I http://127.0.0.1:3000/health
curl -I http://YOUR_EC2_PUBLIC_DNS_OR_DOMAIN/health
pm2 status
sudo systemctl status nginx
```

### Database backup

```bash
chmod +x scripts/backup.sh
node scripts/backup-db.js
# cron: 15 2 * * * /home/ubuntu/cloud-expense-tracker/scripts/backup.sh
```

Keep backups private (home directory permissions). Copy off-instance (for example a private S3 backup prefix) if required by your lab rubric.

---

## H. IAM, Security Groups, and CloudWatch

Run these only in **your** AWS account. Resources are not created by cloning this repo.

### Security group (`YOUR_SG_NAME`)

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | Your IP `/32` | Admin |
| HTTP | 80 | `0.0.0.0/0` | Nginx |
| HTTPS | 443 | `0.0.0.0/0` | After TLS |

Do not open port 3000 to the internet.

### Private S3 bucket

Block all public access. No bucket policy that allows `Principal: "*"`. Default encryption (SSE-S3) is enough for this project.

### IAM instance role

Attach `deploy/iam-s3-policy.json` (replace `YOUR_PRIVATE_BUCKET_NAME`) and `deploy/cloudwatch-iam-policy.json` to `YOUR_EC2_INSTANCE_ROLE_NAME`. Associate the role with the instance.

### CloudWatch Agent

```bash
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
sudo cp ~/cloud-expense-tracker/deploy/cloudwatch-agent.json /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s
```

In the CloudWatch console, confirm log group `/cloud-expense-tracker/app` and metrics namespace `CloudExpenseTracker` **after** the agent is running.

---

## I. Testing, demo, and report

- Local: `npm test` then walk through `docs/DEMO-SCRIPT.md`
- Report skeleton: `docs/REPORT.md`
- Two-user check: data must not leak across accounts
- Do not claim S3/EC2/CloudWatch screenshots until those services exist in your account

## License

MIT — Palak Lodha
