"""
Dashboard Statistiche per HarmonyArchitect.
Genera analytics pedagogiche e visualizzazioni per il progresso dell'utente.
"""

from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
import statistics
from dataclasses import dataclass
from enum import Enum

from core.models.exercise_model import DifficultyLevel, ErrorCategory
from core.database.db_manager import EnhancedDBManager

class ChartType(Enum):
    """Tipi di grafici disponibili"""
    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    HEATMAP = "heatmap"
    RADAR = "radar"

@dataclass
class ChartData:
    """Dati per un grafico"""
    chart_type: ChartType
    title: str
    labels: List[str]
    datasets: List[Dict[str, Any]]
    options: Optional[Dict[str, Any]] = None

@dataclass
class StatsSummary:
    """Riepilogo statistiche"""
    total_sessions: int
    total_exercises: int
    overall_win_rate: float
    current_streak: int
    best_streak: int
    avg_response_time_ms: float
    favorite_level: str
    weakest_category: str
    strongest_category: str

class StatsDashboard:
    """Dashboard per analytics pedagogiche"""
    
    def __init__(self, db_manager: EnhancedDBManager):
        self.db = db_manager
    
    def get_summary_stats(self, days_back: int = 30) -> StatsSummary:
        """
        Restituisce un riepilogo delle statistiche.
        
        Args:
            days_back: Numero di giorni da considerare
        
        Returns:
            Riepilogo statistiche
        """
        # Recupera dati recenti
        recent_practices = self.db.get_recent_practices(limit=1000)
        sessions = self.db.get_practice_sessions(days_back)
        
        if not recent_practices:
            return StatsSummary(
                total_sessions=0,
                total_exercises=0,
                overall_win_rate=0.0,
                current_streak=0,
                best_streak=0,
                avg_response_time_ms=0.0,
                favorite_level="N/A",
                weakest_category="N/A",
                strongest_category="N/A"
            )
        
        # Calcola statistiche base
        total_exercises = len(recent_practices)
        correct_exercises = sum(1 for p in recent_practices if p.is_correct)
        overall_win_rate = (correct_exercises / total_exercises * 100) if total_exercises > 0 else 0
        
        # Calcola streak
        current_streak = 0
        best_streak = 0
        temp_streak = 0
        
        for practice in sorted(recent_practices, key=lambda x: x.timestamp):
            if practice.is_correct:
                temp_streak += 1
                best_streak = max(best_streak, temp_streak)
            else:
                if temp_streak > 0:
                    current_streak = temp_streak
                temp_streak = 0
        
        if temp_streak > 0:
            current_streak = temp_streak
        
        # Tempo medio di risposta
        response_times = [p.response_time_ms for p in recent_practices if p.response_time_ms]
        avg_response_time = statistics.mean(response_times) if response_times else 0
        
        # Livello preferito (più praticato)
        level_counts = {}
        for practice in recent_practices:
            level_counts[practice.level] = level_counts.get(practice.level, 0) + 1
        
        favorite_level = max(level_counts.items(), key=lambda x: x[1])[0] if level_counts else "N/A"
        
        # Analisi categorie errori
        error_analysis = self.db.get_error_analysis(days_back)
        
        weakest_category = "N/A"
        strongest_category = "N/A"
        
        if error_analysis:
            # Categoria con più errori
            weakest = max(error_analysis.items(), key=lambda x: x[1])
            weakest_category = weakest[0].value.replace('_', ' ').title()
            
            # Categoria con meno errori (tra quelle con almeno qualche errore)
            if len(error_analysis) > 1:
                strongest = min(error_analysis.items(), key=lambda x: x[1])
                strongest_category = strongest[0].value.replace('_', ' ').title()
        
        return StatsSummary(
            total_sessions=len(sessions),
            total_exercises=total_exercises,
            overall_win_rate=overall_win_rate,
            current_streak=current_streak,
            best_streak=best_streak,
            avg_response_time_ms=avg_response_time,
            favorite_level=favorite_level,
            weakest_category=weakest_category,
            strongest_category=strongest_category
        )
    
    def get_win_rate_chart(self, days_back: int = 30) -> ChartData:
        """
        Genera grafico del win rate nel tempo.
        
        Args:
            days_back: Numero di giorni da considerare
        
        Returns:
            Dati per grafico a linee
        """
        sessions = self.db.get_practice_sessions(days_back)
        
        if not sessions:
            return ChartData(
                chart_type=ChartType.LINE,
                title="Win Rate nel Tempo",
                labels=["Nessun dato"],
                datasets=[{
                    'label': 'Win Rate %',
                    'data': [0],
                    'borderColor': '#4CAF50',
                    'backgroundColor': 'rgba(76, 175, 80, 0.1)'
                }]
            )
        
        # Ordina per data
        sessions.sort(key=lambda x: x['date'])
        
        labels = [s['date'] for s in sessions]
        win_rates = [s['win_rate'] for s in sessions]
        
        return ChartData(
            chart_type=ChartType.LINE,
            title="Win Rate nel Tempo",
            labels=labels,
            datasets=[{
                'label': 'Win Rate %',
                'data': win_rates,
                'borderColor': '#4CAF50',
                'backgroundColor': 'rgba(76, 175, 80, 0.1)',
                'fill': True,
                'tension': 0.4
            }],
            options={
                'scales': {
                    'y': {
                        'beginAtZero': True,
                        'max': 100,
                        'title': {
                            'display': True,
                            'text': 'Win Rate %'
                        }
                    }
                }
            }
        )
    
    def get_level_performance_chart(self) -> ChartData:
        """
        Genera grafico a barre delle performance per livello.
        
        Returns:
            Dati per grafico a barre
        """
        levels = [
            "1: Triadi Base",
            "2: Settime (Drop 2)",
            "3: Jazz Extensions",
            "4: Advanced (Subs/Alt)"
        ]
        
        win_rates = []
        exercise_counts = []
        
        for level in levels:
            stats = self.db.get_level_stats(level)
            
            if not stats:
                win_rates.append(0)
                exercise_counts.append(0)
                continue
            
            # Calcola win rate medio per il livello
            total_correct = 0
            total_exercises = 0
            
            for exercise_stats in stats.values():
                correct, total, _ = exercise_stats
                total_correct += correct
                total_exercises += total
            
            win_rate = (total_correct / total_exercises * 100) if total_exercises > 0 else 0
            win_rates.append(win_rate)
            exercise_counts.append(total_exercises)
        
        return ChartData(
            chart_type=ChartType.BAR,
            title="Performance per Livello",
            labels=levels,
            datasets=[
                {
                    'label': 'Win Rate %',
                    'data': win_rates,
                    'backgroundColor': [
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)'
                    ],
                    'borderColor': [
                        'rgb(54, 162, 235)',
                        'rgb(255, 99, 132)',
                        'rgb(75, 192, 192)',
                        'rgb(153, 102, 255)'
                    ],
                    'borderWidth': 1
                },
                {
                    'label': 'Esercizi Totali',
                    'data': exercise_counts,
                    'type': 'line',
                    'yAxisID': 'y1',
                    'borderColor': 'rgba(255, 206, 86, 0.8)',
                    'backgroundColor': 'rgba(255, 206, 86, 0.1)'
                }
            ],
            options={
                'scales': {
                    'y': {
                        'beginAtZero': True,
                        'max': 100,
                        'title': {
                            'display': True,
                            'text': 'Win Rate %'
                        }
                    },
                    'y1': {
                        'position': 'right',
                        'beginAtZero': True,
                        'title': {
                            'display': True,
                            'text': 'Esercizi Totali'
                        }
                    }
                }
            }
        )
    
    def get_error_analysis_chart(self, days_back: int = 30) -> ChartData:
        """
        Genera grafico a torta dell'analisi errori.
        
        Args:
            days_back: Numero di giorni da considerare
        
        Returns:
            Dati per grafico a torta
        """
        error_analysis = self.db.get_error_analysis(days_back)
        
        if not error_analysis:
            return ChartData(
                chart_type=ChartType.PIE,
                title="Analisi Errori",
                labels=["Nessun errore registrato"],
                datasets=[{
                    'data': [100],
                    'backgroundColor': ['#4CAF50']
                }]
            )
        
        # Prepara dati per grafico
        labels = []
        data = []
        background_colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
        ]
        
        for i, (error_category, count) in enumerate(error_analysis.items()):
            label = error_category.value.replace('_', ' ').title()
            labels.append(label)
            data.append(count)
        
        return ChartData(
            chart_type=ChartType.PIE,
            title="Analisi Errori per Categoria",
            labels=labels,
            datasets=[{
                'data': data,
                'backgroundColor': background_colors[:len(data)],
                'hoverOffset': 4
            }]
        )
    
    def get_daily_practice_chart(self, days_back: int = 14) -> ChartData:
        """
        Genera grafico della pratica giornaliera.
        
        Args:
            days_back: Numero di giorni da considerare
        
        Returns:
            Dati per grafico a barre
        """
        # Genera date per gli ultimi giorni
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        date_range = []
        current_date = start_date
        
        while current_date <= end_date:
            date_range.append(current_date.strftime('%Y-%m-%d'))
            current_date += timedelta(days=1)
        
        # Recupera sessioni
        sessions = self.db.get_practice_sessions(days_back)
        session_dict = {s['date']: s for s in sessions}
        
        # Prepara dati
        exercise_counts = []
        win_rates = []
        
        for date_str in date_range:
            if date_str in session_dict:
                session = session_dict[date_str]
                exercise_counts.append(session['exercises_attempted'])
                win_rates.append(session['win_rate'])
            else:
                exercise_counts.append(0)
                win_rates.append(0)
        
        return ChartData(
            chart_type=ChartType.BAR,
            title="Pratica Giornaliera",
            labels=date_range,
            datasets=[
                {
                    'label': 'Esercizi Tentati',
                    'data': exercise_counts,
                    'backgroundColor': 'rgba(54, 162, 235, 0.6)',
                    'borderColor': 'rgb(54, 162, 235)',
                    'borderWidth': 1
                },
                {
                    'label': 'Win Rate %',
                    'data': win_rates,
                    'type': 'line',
                    'yAxisID': 'y1',
                    'borderColor': 'rgba(255, 99, 132, 0.8)',
                    'backgroundColor': 'rgba(255, 99, 132, 0.1)',
                    'tension': 0.4
                }
            ],
            options={
                'scales': {
                    'y': {
                        'beginAtZero': True,
                        'title': {
                            'display': True,
                            'text': 'Esercizi Tentati'
                        }
                    },
                    'y1': {
                        'position': 'right',
                        'beginAtZero': True,
                        'max': 100,
                        'title': {
                            'display': True,
                            'text': 'Win Rate %'
                        }
                    }
                }
            }
        )
    
    def get_progress_insights(self, days_back: int = 30) -> List[str]:
        """
        Genera insights pedagogici basati sul progresso.
        
        Args:
            days_back: Numero di giorni da considerare
        
        Returns:
            Lista di insights
        """
        insights = []
        summary = self.get_summary_stats(days_back)
        error_analysis = self.db.get_error_analysis(days_back)
        
        # Insight 1: Streak
        if summary.current_streak >= 3:
            insights.append(f"🔥 Hai una streak di {summary.current_streak} risposte corrette di fila!")
        
        # Insight 2: Win rate
        if summary.overall_win_rate >= 80:
            insights.append("🎯 Ottimo lavoro! Il tuo win rate è superiore all'80%.")
        elif summary.overall_win_rate >= 60:
            insights.append("👍 Buon progresso! Continua a praticare per migliorare.")
        else:
            insights.append("💪 Non arrenderti! La pratica costante migliora l'orecchio armonico.")
        
        # Insight 3: Categoria debole
        if summary.weakest_category != "N/A":
            insights.append(f"🎯 Concentrati su: {summary.weakest_category}. È la tua area di miglioramento.")
        
        # Insight 4: Livello preferito
        if summary.favorite_level != "N/A":
            insights.append(f"⭐ Il tuo livello preferito è: {summary.favorite_level}")
        
        # Insight 5: Pratica regolare
        if summary.total_sessions >= 7:
            insights.append("📅 Ottima costanza! Hai praticato regolarmente nell'ultimo periodo.")
        
        # Insight 6: Tempo di risposta
        if summary.avg_response_time_ms > 0:
            if summary.avg_response_time_ms < 3000:
                insights.append("⚡ Reazione veloce! Il tuo tempo medio di risposta è ottimo.")
            else:
                insights.append("🎵 Prenditi il tuo tempo per ascoltare attentamente ogni accordo.")
        
        # Insight 7: Error pattern
        if error_analysis:
            most_common_error = max(error_analysis.items(), key=lambda x: x[1])[0]
            error_name = most_common_error.value.replace('_', ' ').title()
            insights.append(f"🎯 Pattern di errore: {error_name} è l'errore più comune.")
        
        return insights
    
    def export_report(self, filepath: str) -> bool:
        """
        Esporta un report completo delle statistiche.
        
        Args:
            filepath: Percorso del file di esportazione
        
        Returns:
            True se esportazione riuscita, False altrimenti
        """
        try:
            import json
            from datetime import datetime
            
            # Raccogli dati
            summary = self.get_summary_stats(30)
            insights = self.get_progress_insights(30)
            
            report = {
                'generated_at': datetime.now().isoformat(),
                'period_days': 30,
                'summary': {
                    'total_sessions': summary.total_sessions,
                    'total_exercises': summary.total_exercises,
                    'overall_win_rate': summary.overall_win_rate,
                    'current_streak': summary.current_streak,
                    'best_streak': summary.best_streak,
                    'avg_response_time_ms': summary.avg_response_time_ms,
                    'favorite_level': summary.favorite_level,
                    'weakest_category': summary.weakest_category,
                    'strongest_category': summary.strongest_category
                },
                'insights': insights,
                'charts': {
                    'win_rate_trend': 'Disponibile nella dashboard',
                    'level_performance': 'Disponibile nella dashboard',
                    'error_analysis': 'Disponibile nella dashboard',
                    'daily_practice': 'Disponibile nella dashboard'
                }
            }
            
            # Salva su file
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            
            return True
            
        except Exception as e:
            print(f"Errore esportazione report: {e}")
            return False