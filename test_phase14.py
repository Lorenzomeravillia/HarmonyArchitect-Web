import os
import random
import sqlite3
import time
from app_controller import AppController
from db_manager import DBManager

class MockTkinterVar:
    def __init__(self, value):
        self.value = value
    def get(self):
        return self.value

class MockBtn:
    def configure(self, *args, **kwargs): pass
    def cget(self, *args): return "Btn"

class MockView:
    def __init__(self):
        self.level_var = MockTkinterVar("2: Settime (Drop 2)")
        self.play_mode_var = MockTkinterVar("Accordo Singolo")
        self.training_var = MockTkinterVar("Adaptive")
        
        self.octave_var = MockTkinterVar("C4")
        self.voice_leading_var = MockTkinterVar("Optimized")
        
        # Simulazione delle variabili per gli strumenti delle voci
        self.voice_instrument_vars = [MockTkinterVar("Contrabbasso") for _ in range(7)]
        
        self.answer_buttons = [MockBtn(), MockBtn(), MockBtn(), MockBtn()]
        
    def update_insight(self, *args): pass
    def draw_empty_staff(self, *args): pass
    def reset_solo_buttons(self, *args): pass
    def set_controller(self, *args): pass
    def bind(self, *args): pass
    def show_error(self, *args): pass
    def update_score(self, *args): pass
    def show_ai_focus(self, *args): pass
    
    def setup_answer_buttons(self, all_options, is_progression, font_size):
        print("\n[VERIFICA DISTRATTORI] Opzioni Generate sul Pad:")
        for i, opt in enumerate(all_options):
            nome = opt['name'] if is_progression else opt
            print(f" Opzione {i+1}: {nome}")

def run_tests():
    test_db = "test_harmony_history.db"
    if os.path.exists(test_db):
        os.remove(test_db)
        
    db = DBManager(test_db)
    
    # Simuliamo 12 test passati:
    # L'utente fa schifo su Cmaj7 (0% success).
    # L'utente è perfetto su Cm7 (100% success).
    print("Inizializzazione DB fittizio con 6 errori su Cmaj7 e 6 successi su Cm7...")
    for _ in range(6):
        db.record_answer_async("2: Settime (Drop 2)", "Cmaj7", False)
        db.record_answer_async("2: Settime (Drop 2)", "Cm7", True)
        
    time.sleep(0.5) # Wait for async thread
    
    view = MockView()
    controller = AppController(view)
    controller.db_manager = db
    
    print("\n==================================================")
    print(" TEST 1: ADAPTIVE PESI + ROOT LOCK (Single Chords)")
    print("==================================================")
    controller.on_new_challenge()
    
    print("\n\n==================================================")
    print(" TEST 2: ANTI-RIPETIZIONE (Estrazione consecutiva)")
    print("==================================================")
    # the target chosen in TEST 1 is stored in controller.last_target
    print(f"Ultimo target estratto: {controller.last_target}")
    controller.on_new_challenge()

    print("\n\n==================================================")
    print(" TEST 3: ROOT LOCK SU PROGRESSIONI")
    print("==================================================")
    view.level_var = MockTkinterVar("1: Triadi Base")
    view.play_mode_var = MockTkinterVar("Progressione")
    view.training_var = MockTkinterVar("Standard") 
    
    controller.on_new_challenge()

if __name__ == "__main__":
    run_tests()
