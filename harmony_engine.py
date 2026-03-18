import re
from music21 import interval, pitch

class HarmonyEngine:
    def __init__(self):
        self.base_octave = 4 
        self.qualities = {
            "maj7": ["M3", "P5", "M7"],
            "m7": ["m3", "P5", "m7"],
            "7": ["M3", "P5", "m7"],
            "m7b5": ["m3", "d5", "m7"],
            "dim7": ["m3", "d5", "d7"],
            "dim": ["m3", "d5"],
            "aug": ["M3", "A5"],
            "maj9": ["M3", "P5", "M7", "M9"],
            "m9": ["m3", "P5", "m7", "M9"],
            "9": ["M3", "P5", "m7", "M9"],
            "13": ["M3", "P5", "m7", "M9", "P11", "M13"],
            "alt": ["M3", "d5", "m7", "m9", "A9", "m13"], 
        }

    def set_base_octave(self, octave: int):
        self.base_octave = octave

    def parse_symbol(self, symbol: str) -> list:
        symbol = symbol.replace("7alt", "alt").replace("maj", "maj")
        
        match = re.match(r"^([A-G][b#]?)(.*)", symbol)
        if not match:
            match = re.match(r"^([A-G][\-]?)(.*)", symbol)
            if not match:
                raise ValueError(f"Cannot parse root from symbol: {symbol}")
        
        root_name = match.group(1).replace("-", "b") 
        suffix = match.group(2)
        
        root_pitch = pitch.Pitch(f"{root_name}{self.base_octave}") 
        
        base_intervals = []
        parsed_quality = False
        
        for q in sorted(self.qualities.keys(), key=len, reverse=True):
            if suffix.startswith(q):
                base_intervals = self.qualities[q].copy()
                suffix = suffix[len(q):]
                parsed_quality = True
                break
                
        if not parsed_quality:
            if suffix.startswith("m") or suffix.startswith("-"):
                base_intervals = ["m3", "P5"]
                suffix = suffix[1:]
                if suffix.startswith("7"): 
                    base_intervals.append("m7")
                    suffix = suffix[1:]
            elif suffix == "":
                base_intervals = ["M3", "P5"]
            else:
                base_intervals = ["M3", "P5", "m7"]
                if suffix.startswith("7"): suffix = suffix[1:]

        pitches = [root_pitch]
        
        for iv in base_intervals:
            p = root_pitch.transpose(interval.Interval(iv))
            pitches.append(p)
            
        alts = re.findall(r'([b#]?11|[b#]?13|[b#]?9|[b#]?5)', suffix)
        
        alt_map = {
            "b9": "m9", "9": "M9", "#9": "A9",
            "11": "P11", "#11": "A11", "b5": "d5", "#5": "A5",
            "b13": "m13", "13": "M13"
        }
        
        for alt in alts:
            if alt in alt_map:
                iv_str = alt_map[alt]
                if alt in ["b5", "#5", "#11", "b13"] and "P5" in base_intervals:
                    p5_pitch = root_pitch.transpose(interval.Interval('P5'))
                    pitches = [p for p in pitches if p.nameWithOctave != p5_pitch.nameWithOctave]
                
                p = root_pitch.transpose(interval.Interval(iv_str))
                pitches.append(p)

        unique_pitches = []
        seen = set()
        for p in pitches:
            if p.nameWithOctave not in seen:
                seen.add(p.nameWithOctave)
                unique_pitches.append(p)

        return sorted(unique_pitches, key=lambda p: p.frequency)

    def get_pitches_from_symbol(self, symbol: str) -> list:
        return self.parse_symbol(symbol)

    def tritone_substitution(self, chord_symbol: str) -> str:
        symbol_fmt = chord_symbol.replace("7alt", "alt")
        match = re.match(r"^([A-G][b#\-]?)(.*)", symbol_fmt)
        if not match: return chord_symbol
        
        root_name = match.group(1).replace("-", "b")
        suffix = match.group(2)
        
        root_pitch = pitch.Pitch(f"{root_name}{self.base_octave}")
        sub_root = root_pitch.transpose(interval.Interval('d5'))
        
        if sub_root.accidental and sub_root.accidental.name == 'sharp':
            sub_root = sub_root.getEnharmonic()
            
        if not suffix: suffix = "7"
        elif not suffix.startswith("7") and not suffix.startswith("alt") and not suffix.startswith("9") and not suffix.startswith("13"):
             suffix = "7"
             
        final_root = sub_root.name.replace("-", "b")
        if suffix == "alt":
            suffix = "7alt" 
            
        return f"{final_root}{suffix}"

    def get_secondary_dominants(self, target_symbol: str) -> dict:
        match = re.match(r"^([A-G][b#\-]?)", target_symbol)
        if not match: return {}
        
        target_root_name = match.group(1).replace("-", "b")
        target_root = pitch.Pitch(f"{target_root_name}{self.base_octave}")
        
        v7_root = target_root.transpose(interval.Interval('P5'))
        if v7_root.accidental and v7_root.accidental.name == 'sharp' and target_root.accidental and target_root.accidental.name == 'flat':
            v7_root = v7_root.getEnharmonic()
            
        v7_name = v7_root.name.replace("-", "b")
        v7_symbol = f"{v7_name}7"
        subV7_symbol = self.tritone_substitution(v7_symbol)
        
        return {
            "V7": v7_symbol,
            "subV7": subV7_symbol
        }

    def apply_voicing(self, pitches: list, strategy: str = "drop2") -> list:
        sorted_pitches = sorted(pitches, key=lambda p: p.frequency)
        if len(sorted_pitches) < 4:
            return sorted_pitches
            
        if strategy.lower() == "drop2":
            voice_to_drop = sorted_pitches[-2]
            dropped_voice = voice_to_drop.transpose(interval.Interval('-P8'))
            
            new_pitches = [dropped_voice] + sorted_pitches[:-2] + [sorted_pitches[-1]]
            return sorted(new_pitches, key=lambda p: p.frequency)
            
        return sorted_pitches

    def apply_progression_voicing(self, list_of_raw_chords: list) -> list:
        """
        Applies a mathematically constrained Voice Leading algorithm across a sequence of chords.
        - Bass (Root) is pinned to an anchor octave (base_octave - 1).
        - Upper structure pitches iteratively seek the Midi-Note octave with the absolute minimum 
          Euclidean semitone distance to the antecedent chord's upper structure.
        """
        if not list_of_raw_chords: return []
        
        voiced_chords = []
        # Primo accordo = voicing convenzionale Standard Drop 2 o Fondamentale
        first_chord = self.apply_voicing(list_of_raw_chords[0], strategy="drop2" if len(list_of_raw_chords[0])>=4 else "none")
        voiced_chords.append(first_chord)
        
        for i in range(1, len(list_of_raw_chords)):
            prev_chord = voiced_chords[i-1]
            raw_curr = list_of_raw_chords[i]
            
            if len(raw_curr) == 0:
                voiced_chords.append([])
                continue
            
            # Isolamento della fondamentale su registro rigido
            root_pitch = pitch.Pitch(f"{raw_curr[0].name.replace('-', 'b')}{self.base_octave - 1}")
            
            prev_upper = prev_chord[1:] if len(prev_chord) > 1 else prev_chord
            curr_upper = raw_curr[1:] if len(raw_curr) > 1 else []
            
            new_upper = []
            for p in curr_upper:
                best_dist = float('inf')
                best_octave = 4 # Fallback
                
                # Sonda le ottave mediane (2-6) alla ricerca dello snap più vicino al chord precedente
                for oct_test in range(2, 7):
                    p_test = pitch.Pitch(f"{p.name.replace('-', 'b')}{oct_test}")
                    dist = min([abs(p_test.midi - p_prev.midi) for p_prev in prev_upper]) if prev_upper else 0
                    if dist < best_dist:
                        best_dist = dist
                        best_octave = oct_test
                        
                new_upper.append(pitch.Pitch(f"{p.name.replace('-', 'b')}{best_octave}"))
                
            # Risoluzione incroci (sort dal grave all'acuto)
            new_upper.sort(key=lambda x: x.frequency)
            
            voiced_chords.append([root_pitch] + new_upper)
            
        return voiced_chords
