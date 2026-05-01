"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Eye, EyeOff, Calendar } from "lucide-react";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_SHORT = ["DOM","SEG","TER","QUA","QUI","SEX","SÁB"];

const BR_HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "Ano Novo",
  "2026-02-16": "Carnaval",
  "2026-02-17": "Carnaval",
  "2026-04-03": "Sexta-Feira Santa",
  "2026-04-21": "Tiradentes",
  "2026-05-01": "Dia do Trabalho",
  "2026-05-10": "Dia das Mães",
  "2026-06-11": "Corpus Christi",
  "2026-08-16": "Dia dos Pais",
  "2026-09-07": "Independência",
  "2026-10-12": "Nossa Senhora Aparecida",
  "2026-11-02": "Finados",
  "2026-11-15": "Proclamação da República",
  "2026-12-25": "Natal",
};

type ViewMode = "mes" | "semana" | "dia";

interface Event {
  id: string; title: string; date: string; time?: string; color: string;
}

function pad(n: number) { return n.toString().padStart(2, "0"); }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad(m+1)}-${pad(d)}`; }

export default function AgendaPage() {
  const today = new Date();
  const [view, setView] = useState<ViewMode>("mes");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showHolidays, setShowHolidays] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", date: "", time: "", color: "#8B5CF6" });

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  // Calcular dias do mês
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const addEvent = () => {
    if (!newEvent.title.trim() || !newEvent.date) return;
    setEvents(ev => [...ev, { id: Date.now().toString(), ...newEvent }]);
    setNewEvent({ title: "", date: "", time: "", color: "#8B5CF6" });
    setShowModal(false);
  };

  const inp = "w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground";

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-xl px-6 py-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Timeline de Projetos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Visualização completa de todas as etapas e prazos</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-muted/40 border border-border rounded-xl p-1 gap-0.5">
              {(["mes","semana","dia"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${view === v ? "bg-background shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  {v === "mes" ? "Mês" : v === "semana" ? "Semana" : "Dia"}
                </button>
              ))}
            </div>
            <button onClick={goToday} className="px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
              Hoje
            </button>
            <button className="px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <Calendar className="w-4 h-4" />
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity shadow-elegant">
              <Plus className="w-4 h-4" />Novo Compromisso
            </button>
          </div>
        </div>

        {/* Controles do mês + toggles */}
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-foreground min-w-[120px] text-center">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted-foreground">Mostrar Feriados</span>
              <button onClick={() => setShowHolidays(v => !v)}
                className={`w-9 h-5 rounded-full transition-colors relative ${showHolidays ? "bg-primary" : "bg-muted"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${showHolidays ? "left-4" : "left-0.5"}`} />
              </button>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted-foreground">Tarefas do quadro</span>
              <button onClick={() => setShowTasks(v => !v)}
                className={`w-9 h-5 rounded-full transition-colors relative ${showTasks ? "bg-primary" : "bg-muted"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${showTasks ? "left-4" : "left-0.5"}`} />
              </button>
            </label>
          </div>
        </div>
      </div>

      {/* Calendário */}
      <div className="flex-1 overflow-auto scrollbar-none p-4">
        {view === "mes" && (
          <div className="h-full flex flex-col">
            {/* Cabeçalho dias da semana */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
              ))}
            </div>
            {/* Grid de dias */}
            <div className="grid grid-cols-7 flex-1 gap-px bg-border rounded-2xl overflow-hidden">
              {Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - firstDay + 1;
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const key = isCurrentMonth ? dateKey(year, month, dayNum) : "";
                const holiday = showHolidays && key ? BR_HOLIDAYS_2026[key] : null;
                const dayEvents = events.filter(e => e.date === key);
                const isToday = isCurrentMonth && year === today.getFullYear() && month === today.getMonth() && dayNum === today.getDate();

                return (
                  <div key={idx}
                    className={`bg-background min-h-[60px] sm:min-h-[90px] p-1 sm:p-2 ${!isCurrentMonth ? "opacity-30" : ""}`}>
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1 ${
                      isToday ? "bg-primary text-white" : "text-foreground"
                    }`}>
                      {isCurrentMonth ? dayNum : ""}
                    </div>
                    {holiday && (
                      <div className="text-[8px] sm:text-[9px] font-medium text-primary bg-primary/10 rounded px-1 py-0.5 mb-0.5 truncate hidden sm:block">
                        {holiday}
                      </div>
                    )}
                    {holiday && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mb-0.5 sm:hidden" title={holiday} />
                    )}
                    {dayEvents.map(ev => (
                      <div key={ev.id} className="text-[8px] sm:text-[9px] font-medium rounded px-1 py-0.5 mb-0.5 truncate text-white hidden sm:block"
                        style={{ backgroundColor: ev.color }}>
                        {ev.time && <span className="opacity-80">{ev.time} </span>}{ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full mb-0.5 sm:hidden" style={{ backgroundColor: dayEvents[0].color }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "semana" && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Calendar className="w-12 h-12 opacity-20" />
            <p className="font-medium">Visualização semanal</p>
            <p className="text-xs opacity-60">Em desenvolvimento — use a visão mensal por enquanto</p>
          </div>
        )}

        {view === "dia" && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Calendar className="w-12 h-12 opacity-20" />
            <p className="font-medium">Visualização diária</p>
            <p className="text-xs opacity-60">Em desenvolvimento — use a visão mensal por enquanto</p>
          </div>
        )}
      </div>

      {/* Modal novo compromisso */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md p-6 pb-safe">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">Novo Compromisso</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Título *</label>
                <input value={newEvent.title} onChange={e => setNewEvent(f => ({...f, title: e.target.value}))}
                  placeholder="Ex: Reunião com cliente" className={inp} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Data *</label>
                  <input type="date" value={newEvent.date} onChange={e => setNewEvent(f => ({...f, date: e.target.value}))} className={inp} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Horário</label>
                  <input type="time" value={newEvent.time} onChange={e => setNewEvent(f => ({...f, time: e.target.value}))} className={inp} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Cor</label>
                <div className="flex gap-2">
                  {["#8B5CF6","#6366F1","#EC4899","#10B981","#F59E0B","#3B82F6","#EF4444"].map(cor => (
                    <button key={cor} onClick={() => setNewEvent(f => ({...f, color: cor}))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${newEvent.color === cor ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: cor }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
                Cancelar
              </button>
              <button onClick={addEvent} disabled={!newEvent.title.trim() || !newEvent.date}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                Criar Compromisso
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3 opacity-60">
              Sincronização com Google Agenda disponível em Configurações
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
