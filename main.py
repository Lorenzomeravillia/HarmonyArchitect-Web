import traceback
from app_gui import HarmonyArchitectApp
from app_controller import AppController

def main():
    try:
        app = HarmonyArchitectApp()
        controller = AppController(app)
        controller.start()
        app.mainloop()
    except Exception as e:
        print("Scusami, Fatal Initialization Error:", str(e))
        traceback.print_exc()

if __name__ == "__main__":
    main()
