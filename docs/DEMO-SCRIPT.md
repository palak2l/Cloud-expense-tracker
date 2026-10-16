# Demo script (8–10 minutes)

Values you must replace when showing a live AWS deployment: `YOUR_EC2_PUBLIC_DNS_OR_DOMAIN`, `YOUR_PRIVATE_BUCKET_NAME`, AWS account/region. Local demo does not need them.

1. Open `http://localhost:3000` (or `http://YOUR_EC2_PUBLIC_DNS_OR_DOMAIN`).
2. Toggle **Dark mode** / **Light mode** and show the navy–violet–teal theme.
3. Register a new user (password at least 8 characters). Confirm redirect to the dashboard branded **Cloud Expense Tracker — Made by Palak Lodha**.
4. Show empty-state charts, then add:
   - Income: Salary ₹50,000
   - Expense: Food ₹1,200
   - Expense: Travel ₹800
5. Point to summary cards: income, expenses, balance, monthly savings are calculated from SQLite, not hardcoded.
6. Set a Food budget below ₹1,200 and show the over-budget warning.
7. Search “Food”, edit a description, delete one row, then undo by adding it again.
8. Upload a small PNG receipt, click **View**, then export CSV from History.
9. Log out, register a second account, and show that the first user’s transactions are gone (user-id authorization).
10. Optional AWS: set `STORAGE_DRIVER=s3` on EC2, upload a receipt, and in the S3 console (private bucket `YOUR_PRIVATE_BUCKET_NAME`) show an object under `receipts/<userId>/`.
