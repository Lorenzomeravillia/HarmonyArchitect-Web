"""
UI Interface Contract per architettura cross-platform.
Definisce l'interfaccia astratta per le operazioni UI che devono essere
implementate da ogni piattaforma (desktop, Android, etc.).
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any, Callable
from dataclasses import dataclass
from enum import Enum

class ExerciseType(Enum):
    """Tipi di esercizio disponibili"""
    SINGLE_CHORD = "single_chord"
    CHORD_PROGRESSION = "chord_progression"

class DifficultyLevel(Enum):
    """Livelli di difficoltà"""
    TRIADS_BASIC = "1: Triadi Base"
    SEVENTHS_DROP2 = "2: Settime (Drop 2)"
    JAZZ_EXTENSIONS = "3: Jazz Extensions"
    ADVANCED_SUBS = "4: Advanced (Subs/Alt)"

@dataclass
class ExerciseOption:
    """Opzione di esercizio per la UI"""
    display_text: str
    value: Any
    is_correct: bool = False

@dataclass
class ExerciseStats:
    """Statistiche di un esercizio"""
    exercise_id: str
    correct_count: int
    total_count: int
    win_rate: float
    last_practiced: Optional[str] = None
    difficulty_weight: float = 1.0

@dataclass
class PracticeSession:
    """Dati di una sessione di pratica"""
    session_id: str
    start_time: str
    duration_minutes: int
    exercises_attempted: int
    exercises_correct: int
    level: DifficultyLevel

class UIInterface(ABC):
    """Interfaccia astratta per operazioni UI cross-platform"""
    
    @abstractmethod
    def show_exercise(self, exercise_type: ExerciseType, 
                     question: str, options: List[ExerciseOption],
                     on_answer_selected: Callable[[int], None]) -> None:
        """
        Mostra un esercizio all'utente.
        
        Args:
            exercise_type: Tipo di esercizio
            question: Testo della domanda/istruzione
            options: Lista di opzioni di risposta
            on_answer_selected: Callback quando l'utente seleziona una risposta
        """
        pass
    
    @abstractmethod
    def update_feedback(self, is_correct: bool, feedback_text: str,
                       correct_answer: Optional[str] = None) -> None:
        """
        Aggiorna il feedback dopo una risposta.
        
        Args:
            is_correct: True se la risposta era corretta
            feedback_text: Testo di feedback
            correct_answer: Risposta corretta (se sbagliata)
        """
        pass
    
    @abstractmethod
    def show_audio_controls(self, on_play: Callable[[], None],
                           on_arpeggio: Callable[[], None],
                           on_voice_solo: Callable[[int], None]) -> None:
        """
        Mostra i controlli audio.
        
        Args:
            on_play: Callback per play accordo
            on_arpeggio: Callback per arpeggio
            on_voice_solo: Callback per isolamento voce (riceve indice voce)
        """
        pass
    
    @abstractmethod
    def update_score_display(self, current_score: int, total_attempts: int,
                            win_rate: float, combo: int) -> None:
        """
        Aggiorna il display del punteggio.
        
        Args:
            current_score: Punteggio corrente
            total_attempts: Tentativi totali
            win_rate: Percentuale di successo
            combo: Combo corrente
        """
        pass
    
    @abstractmethod
    def show_settings(self, current_settings: Dict[str, Any],
                     on_settings_changed: Callable[[Dict[str, Any]], None]) -> None:
        """
        Mostra le impostazioni.
        
        Args:
            current_settings: Impostazioni correnti
            on_settings_changed: Callback quando le impostazioni cambiano
        """
        pass
    
    @abstractmethod
    def show_stats_dashboard(self, stats: List[ExerciseStats],
                            session_history: List[PracticeSession]) -> None:
        """
        Mostra la dashboard delle statistiche.
        
        Args:
            stats: Statistiche per esercizio
            session_history: Cronologia sessioni
        """
        pass
    
    @abstractmethod
    def show_theory_insight(self, insight_text: str, 
                           duration_seconds: Optional[int] = None) -> None:
        """
        Mostra un insight teorico.
        
        Args:
            insight_text: Testo dell'insight
            duration_seconds: Durata visualizzazione (None = permanente)
        """
        pass
    
    @abstractmethod
    def show_error(self, title: str, message: str, 
                  details: Optional[str] = None) -> None:
        """
        Mostra un messaggio di errore.
        
        Args:
            title: Titolo dell'errore
            message: Messaggio dell'errore
            details: Dettagli tecnici (opzionale)
        """
        pass
    
    @abstractmethod
    def show_loading(self, message: str) -> None:
        """
        Mostra indicatore di caricamento.
        
        Args:
            message: Messaggio da visualizzare
        """
        pass
    
    @abstractmethod
    def hide_loading(self) -> None:
        """Nasconde l'indicatore di caricamento."""
        pass
    
    @abstractmethod
    def vibrate(self, duration_ms: int = 100) -> None:
        """
        Attiva la vibrazione (se supportata dalla piattaforma).
        
        Args:
            duration_ms: Durata vibrazione in millisecondi
        """
        pass
    
    @abstractmethod
    def play_feedback_sound(self, sound_type: str) -> None:
        """
        Riproduce un suono di feedback.
        
        Args:
            sound_type: Tipo di suono ('correct', 'wrong', 'click')
        """
        pass
    
    @abstractmethod
    def get_screen_info(self) -> Dict[str, Any]:
        """
        Restituisce informazioni sullo schermo.
        
        Returns:
            Dict con: width, height, dpi, is_touch
        """
        pass