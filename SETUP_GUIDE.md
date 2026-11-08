# Auto Money Engine — Setup Guide

## 1. Add the ENCRYPTION_KEY (required)

Every affiliate API key you save gets encrypted with AES-256-GCM.
Losing this key means losing every saved key.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"