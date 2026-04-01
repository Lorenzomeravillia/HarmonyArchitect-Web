"""
Classificatore di errori per analisi pedagogica musicale.
Classifica gli errori degli utente in categorie pedagogiche per fornire
feedback mirato e suggerimenti personalizzati.
"""

import re
from typing import Optional, Tuple, List, Dict
from core.models.exercise_model import ErrorCategory

class ErrorClassifier:
    """Classificatore per errori di riconoscimento armonico"""
    
    def __init__(self):
        # Pattern per classificazione degli accordi
        self.chord_patterns = {
            'major': r'^([A-G][b#]?)(maj|M)?(\d+)?$',
            'minor': r'^([A-G][b#]?)m(\d+)?$',
            'dominant': r'^([A-G][b#]?)(7|\d+)(?!maj|M)$',
            'diminished': r'^([A-G][b#]?)dim(\d+)?$',
            'augmented': r'^([A-G][b#]?)aug(\d+)?$',
            'half_diminished': r'^([A-G][b#]?)m7b5$',
            'altered': r'^([A-G][b#]?)(7|9|13)(alt|b9|#9|b5|#5)$'
        }
        
        # Mappa di suggerimenti per categorie di errori
        self.suggestions_map = {
            ErrorCategory.MAJOR_MINOR_CONFUSION: [
                "Gli accordi maggiori hanno una sonorità 'aperta' e brillante",
                "Gli accordi minori hanno una sonorità più 'misteriosa' o malinconica",
                "La differenza principale è nella terza: maggiore (4 semitoni dalla fondamentale) vs minore (3 semitoni)",
                "Prova a cantare la terza dell'accordo per distinguere maggiore/minore"
            ],
            ErrorCategory.SEVENTH_CONFUSION: [
                "Cmaj7 ha la 7° maggiore (11 semitoni dalla fondamentale)",
                "Cm7 ha la 7° minore (10 semitoni dalla fondamentale)",
                "C7 (dominante) ha la 7° minore ma non è un accordo minore",
                "L'accordo di dominante (C7) ha un carattere più 'instabile' che richiede risoluzione"
            ],
            ErrorCategory.EXTENSION_CONFUSION: [
                "Le estensioni (9, 11, 13) aggiungono colore senza cambiare la funzione armonica",
                "Cmaj9 è ancora un accordo maggiore, solo più ricco",
                "C9 è ancora un accordo di dominante, solo più complesso",
                "Le estensioni spesso appaiono nelle voicing drop2/3"
            ],
            ErrorCategory.ALTERATION_CONFUSION: [
                "Gli accordi alterati (alt, b9, #9, b5, #5) sono tipici del jazz",
                "Le alterazioni creano tensioni che richiedono risoluzione",
                "Gli accordi alterati spesso sostituiscono accordi di dominante",
                "Prova a identificare la qualità 'aspra' o 'dissonante' delle alterazioni"
            ],
            ErrorCategory.ROOT_CONFUSION: [
                "Il root (fondamentale) è la nota più importante dell'accordo",
                "Ascolta la nota più bassa - spesso è la fondamentale",
                "Prova a cantare la fondamentale prima di identificare l'accordo",
                "Gli accordi in voicing drop2 spesso hanno il root nella voce più bassa"
            ],
            ErrorCategory.VOICING_CONFUSION: [
                "Drop2 voicing: la seconda voce più alta viene spostata sotto",
                "Close voicing: tutte le voci sono vicino l'una all'altra",
                "Open voicing: le voci sono distribuite su un range più ampio",
                "La disposizione delle voci cambia il carattere ma non la funzione dell'accordo"
            ],
            ErrorCategory.PROGRESSION_CONFUSION: [
                "Le progressioni hanno un flow - ogni accordo prepara il successivo",
                "II-V-I è la progressione più comune nel jazz",
                "I-IV-V-I è la progressione più comune nella musica pop/rock",
                "Ascolta la direzione del basso nelle progressioni"
            ]
        }
    
    def classify_error(self, correct_chord: str, user_answer: str,
                      exercise_type: str = "single_chord") -> Optional[ErrorCategory]:
        """
        Classifica l'errore basato sull'accordo corretto e la risposta dell'utente.
        
        Args:
            correct_chord: Accordo corretto (o progressione)
            user_answer: Risposta dell'utente
            exercise_type: Tipo di esercizio
        
        Returns:
            Categoria dell'errore o None se non classificabile
        """
        if exercise_type == "progression":
            return self._classify_progression_error(correct_chord, user_answer)
        
        return self._classify_single_chord_error(correct_chord, user_answer)
    
    def _classify_single_chord_error(self, correct: str, answer: str) -> Optional[ErrorCategory]:
        """Classifica errore per accordo singolo"""
        
        # Estrai informazioni dagli accordi
        correct_info = self._analyze_chord(correct)
        answer_info = self._analyze_chord(answer)
        
        if not correct_info or not answer_info:
            return ErrorCategory.OTHER
        
        # Confusione maggiore/minore
        if correct_info['quality'] in ['major', 'minor'] and \
           answer_info['quality'] in ['major', 'minor'] and \
           correct_info['quality'] != answer_info['quality']:
            return ErrorCategory.MAJOR_MINOR_CONFUSION
        
        # Confusione settime
        if '7' in correct_info['extensions'] and '7' in answer_info['extensions']:
            if correct_info['seventh_type'] != answer_info['seventh_type']:
                return ErrorCategory.SEVENTH_CONFUSION
        
        # Confusione estensioni
        if correct_info['has_extensions'] and answer_info['has_extensions']:
            ext_diff = set(correct_info['extensions']) != set(answer_info['extensions'])
            if ext_diff and correct_info['quality'] == answer_info['quality']:
                return ErrorCategory.EXTENSION_CONFUSION
        
        # Confusione alterazioni
        if correct_info['has_alterations'] or answer_info['has_alterations']:
            if correct_info['quality'] == answer_info['quality']:
                return ErrorCategory.ALTERATION_CONFUSION
        
        # Confusione root
        if correct_info['root'] != answer_info['root']:
            return ErrorCategory.ROOT_CONFUSION
        
        return ErrorCategory.OTHER
    
    def _classify_progression_error(self, correct: str, answer: str) -> Optional[ErrorCategory]:
        """Classifica errore per progressione"""
        # Per progressioni, confrontiamo la struttura generale
        correct_chords = correct.split('|')
        answer_chords = answer.split('|')
        
        if len(correct_chords) != len(answer_chords):
            return ErrorCategory.PROGRESSION_CONFUSION
        
        # Conta errori per tipo
        error_counts = {}
        for i, (c, a) in enumerate(zip(correct_chords, answer_chords)):
            error_type = self._classify_single_chord_error(c, a)
            if error_type:
                error_counts[error_type] = error_counts.get(error_type, 0) + 1
        
        if not error_counts:
            return ErrorCategory.OTHER
        
        # Restituisce la categoria più comune
        most_common = max(error_counts.items(), key=lambda x: x[1])
        return most_common[0]
    
    def _analyze_chord(self, chord_str: str) -> Optional[Dict]:
        """Analizza un accordo per estrarre informazioni strutturali"""
        if not chord_str:
            return None
        
        # Pattern di analisi
        patterns = [
            # Maj7, Maj9, etc
            (r'^([A-G][b#]?)(maj|M)(\d+)?$', 'major', True),
            # Minor chords
            (r'^([A-G][b#]?)m(\d+)?$', 'minor', True),
            # Dominant 7th
            (r'^([A-G][b#]?)7$', 'dominant', False),
            # Dominant with extensions
            (r'^([A-G][b#]?)(9|11|13)$', 'dominant', True),
            # Diminished
            (r'^([A-G][b#]?)dim(\d+)?$', 'diminished', False),
            # Augmented
            (r'^([A-G][b#]?)aug(\d+)?$', 'augmented', False),
            # Half-diminished
            (r'^([A-G][b#]?)m7b5$', 'half_diminished', True),
            # Altered
            (r'^([A-G][b#]?)(7|9|13)(alt|b9|#9|b5|#5)$', 'altered', True),
            # Simple major
            (r'^([A-G][b#]?)$', 'major', False),
            # Simple minor (con m)
            (r'^([A-G][b#]?)m$', 'minor', False)
        ]
        
        for pattern, quality, has_extensions in patterns:
            match = re.match(pattern, chord_str)
            if match:
                root = match.group(1)
                
                # Estrai estensioni
                extensions = []
                if has_extensions:
                    ext_match = re.search(r'(\d+|b\d+|#\d+|alt)', chord_str)
                    if ext_match:
                        extensions.append(ext_match.group(1))
                
                # Determina tipo di settima
                seventh_type = None
                if '7' in chord_str:
                    if 'maj7' in chord_str or 'M7' in chord_str:
                        seventh_type = 'major'
                    elif 'm7' in chord_str:
                        seventh_type = 'minor'
                    else:
                        seventh_type = 'dominant'
                
                # Check alterazioni
                has_alterations = any(alt in chord_str for alt in ['alt', 'b5', '#5', 'b9', '#9'])
                
                return {
                    'root': root,
                    'quality': quality,
                    'has_extensions': has_extensions,
                    'extensions': extensions,
                    'seventh_type': seventh_type,
                    'has_alterations': has_alterations
                }
        
        return None
    
    def get_suggestion_for_error(self, error_category: ErrorCategory) -> str:
        """
        Restituisce un suggerimento pedagogico per una categoria di errore.
        
        Args:
            error_category: Categoria dell'errore
        
        Returns:
            Suggerimento pedagogico
        """
        suggestions = self.suggestions_map.get(error_category, [
            "Continua a praticare! L'orecchio armonico si sviluppa con tempo e pratica regolare.",
            "Prova a concentrarti su una sola caratteristica dell'accordo (es. la terza maggiore/minore)",
            "Ascolta l'accordo più volte prima di rispondere"
        ])
        
        # Seleziona random suggestion (per varietà)
        import random
        return random.choice(suggestions)
    
    def get_error_pattern(self, error_history: List[ErrorCategory]) -> Optional[ErrorCategory]:
        """
        Identifica pattern di errori ricorrenti dalla cronologia.
        
        Args:
            error_history: Lista di errori recenti
        
        Returns:
            Pattern più comune o None
        """
        if not error_history:
            return None
        
        # Conta frequenze
        frequencies = {}
        for error in error_history:
            frequencies[error] = frequencies.get(error, 0) + 1
        
        # Trova errore più comune
        most_common = max(frequencies.items(), key=lambda x: x[1])
        
        # Solo se appare almeno 3 volte e è > 30% degli errori
        total_errors = len(error_history)
        if most_common[1] >= 3 and most_common[1] / total_errors > 0.3:
            return most_common[0]
        
        return None