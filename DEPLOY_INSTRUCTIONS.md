# Deploy Instructions

## Step 1: Login to Firebase with correct account

Run this command in your terminal:
```bash
firebase login
```

**Important**: When prompted, select **abdixaliim@gmail.com** (not qbbeltd@gmail.com)

## Step 2: Verify project access

After logging in, verify you can see the project:
```bash
firebase projects:list
```

You should see `somtms-fec81` in the list.

## Step 3: Deploy

Once logged in with the correct account, run:
```bash
firebase deploy --only hosting
```

## What's Already Ready

✅ App is built (`dist` folder is ready)
✅ `firebase.json` is configured
✅ Domain `app.somtms.com` is set up
✅ SSL certificate is provisioning

Just need to login and deploy!


