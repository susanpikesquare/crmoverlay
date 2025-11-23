# Adding Screenshots to the Landing Page

This directory contains screenshots displayed on the FormationIQ marketing landing page.

## How to Add Screenshots

### Step 1: Take Screenshots

Capture screenshots of the following pages in your application:

1. **Dashboard Overview** (`dashboard.png`)
   - Navigate to the main dashboard
   - Take a full-page screenshot
   - Recommended size: 1920x1080 or higher

2. **Account 360° View** (`account360.png`)
   - Navigate to any account detail page
   - Take a full-page screenshot
   - Recommended size: 1920x1080 or higher

3. **Opportunities List** (`opportunities.png`)
   - Navigate to the opportunities list page
   - Take a full-page screenshot
   - Recommended size: 1920x1080 or higher

### Step 2: Prepare Your Images

- **Format**: PNG or JPG
- **Recommended resolution**: 1920x1080 or higher
- **File size**: Optimize to under 500KB for faster loading
- **Names**: Use the exact names specified:
  - `dashboard.png`
  - `account360.png`
  - `opportunities.png`

### Step 3: Add Images to This Directory

Place your screenshot files in this directory:
```
frontend/public/screenshots/
├── README.md (this file)
├── dashboard.png
├── account360.png
└── opportunities.png
```

### Step 4: Deploy

After adding the screenshots:

```bash
# From the root project directory
git add frontend/public/screenshots/
git commit -m "Add landing page screenshots"
git push heroku main
```

The landing page will automatically display your screenshots!

## Image Optimization Tips

For best results:
- Use high-quality screenshots from actual app usage
- Ensure text is readable
- Crop to show the most important features
- Use tools like TinyPNG or ImageOptim to compress without quality loss
- Consider blurring any sensitive customer data

## Fallback Behavior

If screenshot images are not found, the landing page will automatically show placeholder graphics with an icon and the screenshot title.
