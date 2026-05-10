import time
import sys
import pyautogui
import pygetwindow as gw

def focus_window_by_keywords(keywords):
    """
    Bulletproof focus function.
    Checks for active windows, prevents spoofing, and uses the Alt-hack.
    """
    try:
        active_win = gw.getActiveWindow()
        active_title = active_win.title if active_win else ""
    except:
        active_title = ""

    for keyword in keywords:
        matches = gw.getWindowsWithTitle(keyword)
        for win in matches:
            # 🌟 ANTI-SPOOFING: Ignore Chrome tabs pretending to be Excel
            if keyword == "Excel" and "Chrome" in win.title:
                continue 
                
            # 🌟 ACTIVE CHECK: If the correct window is already in front, skip the Alt hack
            if win.title == active_title:
                return win
                
            try:
                if win.isMinimized:
                    win.restore()
                
                # 🌟 THE SECRET SAUCE: The Alt-Hack to steal focus
                pyautogui.press('alt')
                win.activate()
                
                # Clear any accidental menus and give Excel time to wake up
                time.sleep(0.5)
                pyautogui.press('esc') 
                
                print(f"🪟 Success: Forced focus on '{win.title}'.")
                return win
            except Exception as e:
                print(f"⚠️ Focus hack failed on {win.title}: {e}")
                
    return None

def execute_actions(data):
    """
    Executes a series of GUI actions using pyautogui.
    Uses DYNAMIC app targeting based on the AI's instructions!
    """
    print("\n--- STARTING RPA EXECUTION ---")
    try:
        global_confidence = data.get('confidence_score')
        if global_confidence is not None and global_confidence < 0.65:
            print("⚠️ Halting: Low confidence.")
            sys.exit(1)

        actions = data.get('actions_to_take', [])
        if not actions:
            print("No actions found.")
            return

        for index, action in enumerate(actions):
            action_type = action.get('action_type')
            step_num = action.get('step', index + 1)
            desc = action.get('description', 'Executing AI action')
            
            raw_keywords = action.get('target_app_keywords', ["Excel", "Sheets", "Chrome"])
            
            # 🌟 ROUTING OVERRIDE: Prioritize Desktop Spreadsheets
            if any(k in raw_keywords for k in ["Excel", "Sheets"]):
                target_keywords = ["Excel", "Sheets", "Chrome"]
            else:
                target_keywords = raw_keywords
            
            print(f"\nExecuting Step {step_num}: {desc}...")

            if action_type == 'move_and_click':
                coords = action.get('target_coordinates')
                if isinstance(coords, dict) and 'x' in coords and 'y' in coords:
                    active_window = focus_window_by_keywords(target_keywords)
                    if active_window:
                        target_x = int(active_window.left + (active_window.width * coords['x']))
                        target_y = int(active_window.top + (active_window.height * coords['y']))
                        pyautogui.moveTo(target_x, target_y, duration=0.2) 
                        pyautogui.click()

            elif action_type == 'type_text':
                payload = action.get('payload', '')
                if payload:
                    target_window = focus_window_by_keywords(target_keywords)
                    if target_window:
                        print(f"   ↳ Injecting text: '{payload}'")
                        pyautogui.write(str(payload), interval=0.01) 

            elif action_type == 'press_key':
                payload = action.get('payload')
                if payload:
                    # 🌟 CRITICAL FIX: Focus the window BEFORE pressing the key!
                    target_window = focus_window_by_keywords(target_keywords)
                    if target_window:
                        print(f"   ↳ Pressing key: '{payload}'")
                        
                        # 🌟 FIX 2: Explicitly kill any stuck modifier keys before pressing
                        pyautogui.keyUp('alt') 
                        pyautogui.keyUp('shift')
                        pyautogui.keyUp('ctrl')
                        
                        pyautogui.press(payload)

            time.sleep(0.2)

        print("\n✅ All actions executed successfully.")

    except Exception as e:
        print(f"❌ RPA Error: {e}")
