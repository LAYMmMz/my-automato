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
