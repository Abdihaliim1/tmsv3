# Firebase Hosting DNS Setup for app.somtms.com

## Important: Domain Configuration

You need to add **`app.somtms.com`** (subdomain), not `somtms.com` (root domain) to Firebase Hosting.

## Step-by-Step DNS Setup

### 1. Add Custom Domain in Firebase Console

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Enter: **`app.somtms.com`** (NOT `somtms.com`)
4. Firebase will generate DNS records

### 2. DNS Records You'll Need to Add

Firebase will provide you with records like:

**Add these records:**
- **A Record** (or CNAME):
  - Type: `A` or `CNAME`
  - Name: `app` (or `app.somtms.com` depending on your DNS provider)
  - Value: `199.36.158.100` (or the IP Firebase provides)
  - TTL: `1800` (30 minutes) or `3600` (1 hour)

- **TXT Record** (for verification):
  - Type: `TXT`
  - Name: `app` (or `app.somtms.com`)
  - Value: `hosting-site=somtms-fec81` (or what Firebase provides)

### 3. Common DNS Provider Instructions

#### Cloudflare
1. Go to DNS → Records
2. Click "Add record"
3. For A record:
   - Type: `A`
   - Name: `app`
   - IPv4 address: `199.36.158.100`
   - Proxy status: DNS only (gray cloud)
   - TTL: Auto
4. For TXT record:
   - Type: `TXT`
   - Name: `app`
   - Content: `hosting-site=somtms-fec81`
   - TTL: Auto

#### GoDaddy / Namecheap / Other
1. Go to DNS Management
2. Add A record:
   - Host: `app`
   - Type: `A`
   - Points to: `199.36.158.100`
   - TTL: `1800`
3. Add TXT record:
   - Host: `app`
   - Type: `TXT`
   - Value: `hosting-site=somtms-fec81`
   - TTL: `1800`

### 4. Troubleshooting "Record data is invalid" Error

If you see "Record data is invalid" when adding the A record:

**Common causes:**
1. **Wrong record type**: Make sure you're adding an `A` record, not `AAAA` or `CNAME`
2. **Invalid IP format**: The IP should be exactly as Firebase provides (e.g., `199.36.158.100`)
3. **Name field issue**: 
   - If adding for `app.somtms.com`, the Name field should be just `app` (not `app.somtms.com`)
   - Some providers require `app.somtms.com` - check your provider's documentation
4. **TTL value**: Use a valid TTL (e.g., `1800` for 30 minutes, `3600` for 1 hour)
5. **Duplicate record**: Check if an A record for `app` already exists

**Solution:**
- Remove any existing A records for `app` or `app.somtms.com`
- Wait 5-10 minutes for DNS propagation
- Add the new A record exactly as Firebase specifies
- Make sure the IP address matches exactly (no spaces, correct format)

### 5. Verification Steps

After adding DNS records:

1. **Wait for DNS propagation** (5-60 minutes, usually 15-30 minutes)
2. **Verify in Firebase Console**:
   - Go to Hosting → Custom domains
   - Click on `app.somtms.com`
   - Status should change from "Pending" to "Connected" (green checkmark)
3. **Test the domain**:
   ```bash
   # Check DNS resolution
   nslookup app.somtms.com
   
   # Should return: 199.36.158.100 (or Firebase's IP)
   ```
4. **Test HTTPS**:
   - Visit `https://app.somtms.com`
   - Should load your app with valid SSL certificate

### 6. If You Already Added somtms.com (Root Domain)

If you accidentally added `somtms.com` instead of `app.somtms.com`:

1. **Option A: Remove and re-add** (Recommended)
   - Remove `somtms.com` from Firebase Hosting
   - Add `app.somtms.com` instead
   - Follow DNS setup above

2. **Option B: Keep root domain, add subdomain**
   - Keep `somtms.com` for future use
   - Add `app.somtms.com` as a separate custom domain
   - Configure DNS for both

### 7. SSL Certificate

Firebase automatically provisions SSL certificates:
- After DNS verification completes
- Usually takes 5-10 minutes
- Certificate is valid for `app.somtms.com` and `*.app.somtms.com`

## Testing Checklist

- [ ] DNS A record added for `app` subdomain
- [ ] DNS TXT record added for verification
- [ ] DNS propagation complete (check with `nslookup`)
- [ ] Firebase shows domain as "Connected"
- [ ] SSL certificate provisioned (green lock icon)
- [ ] `https://app.somtms.com` loads the app
- [ ] No subdomain routing logic in code (already done ✅)

## Common Issues

### Issue: "Domain verification failed"
**Solution**: 
- Double-check TXT record is exactly as Firebase provides
- Wait longer for DNS propagation
- Try removing and re-adding the TXT record

### Issue: "SSL certificate provisioning failed"
**Solution**:
- Ensure DNS is fully propagated
- Remove and re-add the domain in Firebase
- Contact Firebase support if persists

### Issue: "App loads but shows wrong content"
**Solution**:
- Check Firebase Hosting site configuration
- Ensure you're deploying to the correct Firebase project
- Verify `firebase.json` has correct `public` directory

## Next Steps After DNS Setup

1. Deploy your app:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

2. Test the app:
   - Visit `https://app.somtms.com`
   - Verify login works
   - Test tenant selection flow
   - Verify all pages load correctly

3. Update any hardcoded URLs in your code/docs to use `app.somtms.com`


