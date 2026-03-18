from harmony_engine import HarmonyEngine

def main():
    try:
        engine = HarmonyEngine()
        
        print("\n=== HARMONY ENGINE TEST START ===\n")
        
        # 1. Parsing extensions
        print("1. Parsing test")
        cmaj7 = engine.parse_symbol("Cmaj7")
        print(f"Notes in Cmaj7: {[p.nameWithOctave for p in cmaj7]}")
        
        g7alt = engine.parse_symbol("G7alt")
        print(f"Notes in G7alt: {[p.nameWithOctave for p in g7alt]}")
        
        bb7s11 = engine.parse_symbol("Bb7#11")
        print(f"Notes in Bb7#11: {[p.nameWithOctave for p in bb7s11]}")
        
        # 2. Advanced Functions
        print("\n2. Advanced Harmonic Functions")
        subv7 = engine.tritone_substitution("G7")
        print(f"Tritone substitution of G7 -> {subv7}")
        
        sec_doms = engine.get_secondary_dominants("Cmaj7")
        print(f"Secondary dominants for Cmaj7 -> {sec_doms}")
        
        # 3. Progression Voicing Test
        print("\n3. Progression II - subV7 - I with Drop 2 Voicing")
        progression = ["Dm7", "Db7", "Cmaj7"]
        
        for symbol in progression:
            raw = engine.get_pitches_from_symbol(symbol)
            drop2 = engine.apply_voicing(raw, strategy="drop2")
            
            # Display
            chord_name = symbol.ljust(6)
            raw_str = "[" + ", ".join([p.nameWithOctave for p in raw]) + "]"
            drop2_str = "[" + ", ".join([p.nameWithOctave for p in drop2]) + "]"
            
            print(f"Chord: {chord_name} | Raw (Root Position): {raw_str.ljust(35)} | Drop 2: {drop2_str}")
            
    except Exception as e:
        print(f"Errore durante l'esecuzione: {e}")

if __name__ == "__main__":
    main()
