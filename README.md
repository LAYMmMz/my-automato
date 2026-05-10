⚠️ Judging Notice: Hybrid Cloud-to-Local Architecture
"Automato" is an agentic RPA system designed to physically interact with desktop operating systems (e.g., driving Microsoft Excel).

To ensure enterprise-grade security and OS-level execution, our architecture is split:

The Cloud Dashboard (Vercel): Handles the UI, workflow queueing, and API routing.

The Local Muscle (FastAPI + PyAutoGUI): Runs strictly on the host machine to execute physical keystrokes and mouse movements.

Because the agent directly manipulates local software, the live Vercel execution buttons are currently disconnected from our local development server to prevent unauthorized desktop remote control. >
📺 Please watch our Demo Video below to see the complete, end-to-end execution where the cloud dashboard successfully commands the local operating system.

HOW TO USE:
1. Deploy the react frontend using vercel.
2. Put app.py, rpa_executor, and ai_engine in the same folder/directory
3. Run app.py
4. Input ngrok http 8000 in cmd
5. Reload the frontend

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
