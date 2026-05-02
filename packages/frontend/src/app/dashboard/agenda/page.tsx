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
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("agenda_events");
    if (saved) {
      try { setEvents(JSON.parse(saved)); } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("agenda_events", JSON.stringify(events));
    }
  }, [events, isLoaded]);

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

            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity shadow-elegant">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Compromisso</span>
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

        {view === "semana" && (() => {
          const weekStart = new Date(year, month - (month !== new Date().getMonth() || year !== new Date().getFullYear() ? 0 : 0), 1);
          // Calcular início da semana atual (domingo)
          const today2 = new Date();
          const dayOfWeek = today2.getDay();
          const startOfWeek = new Date(today2);
          startOfWeek.setDate(today2.getDate() - dayOfWeek);
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d;
          });
          const hours = Array.from({ length: 24 }, (_, i) => i);
          return (
            <div className="flex flex-col h-full">
              {/* Header dos dias */}
              <div className="grid grid-cols-8 border-b border-border shrink-0">
                <div className="py-3" />
                {weekDays.map((d, i) => {
                  const isToday = d.toDateString() === new Date().toDateString();
                  const holiday = Object.entries(BR_HOLIDAYS_2026).find(([k]) => k === `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
                  return (
                    <div key={i} className="text-center py-2 border-l border-border">
                      <p className="text-xs text-muted-foreground">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()]}</p>
                      <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-sm font-bold mt-0.5 ${isToday ? "bg-primary text-white" : "text-foreground"}`}>
                        {d.getDate()}
                      </div>
                      {holiday && <div className="text-[9px] text-primary truncate px-1">{holiday[1]}</div>}
                    </div>
                  );
                })}
              </div>
              {/* Grid de horas */}
              <div className="flex-1 overflow-y-auto scrollbar-none">
                {hours.map(h => (
                  <div key={h} className="grid grid-cols-8 border-b border-border/40 min-h-[48px]">
                    <div className="text-[10px] text-muted-foreground px-2 py-1 shrink-0">{String(h).padStart(2,'0')}:00</div>
                    {weekDays.map((d, i) => {
                      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                      const dayEvs = events.filter(e => e.date === key && e.time?.startsWith(String(h).padStart(2,'0')));
                      return (
                        <div key={i} className="border-l border-border/40 px-1 py-0.5">
                          {dayEvs.map(ev => (
                            <div key={ev.id} className="text-[9px] font-medium text-white rounded px-1 truncate mb-0.5"
                              style={{ backgroundColor: ev.color }}>{ev.time} {ev.title}</div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {view === "dia" && (() => {
          const today2 = new Date();
          const dayKey = `${today2.getFullYear()}-${String(today2.getMonth()+1).padStart(2,'0')}-${String(today2.getDate()).padStart(2,'0')}`;
          const hours = Array.from({ length: 24 }, (_, i) => i);
          const holiday = BR_HOLIDAYS_2026[dayKey];
          return (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-center gap-3 py-4 border-b border-border shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary text-white font-black text-xl flex items-center justify-center">
                  {today2.getDate()}
                </div>
                <div>
                  <p className="font-bold text-foreground">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][today2.getDay()]}</p>
                  {holiday && <p className="text-xs text-primary">{holiday}</p>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-none">
                {hours.map(h => {
                  const dayEvs = events.filter(e => e.date === dayKey && e.time?.startsWith(String(h).padStart(2,'0')));
                  return (
                    <div key={h} className="flex gap-3 border-b border-border/40 min-h-[56px] px-4 py-1">
                      <span className="text-xs text-muted-foreground w-10 shrink-0 pt-1">{String(h).padStart(2,'0')}:00</span>
                      <div className="flex-1">
                        {dayEvs.map(ev => (
                          <div key={ev.id} className="text-xs font-medium text-white rounded-lg px-2 py-1 mb-0.5 flex items-center gap-2"
                            style={{ backgroundColor: ev.color }}>
                            <span>{ev.time}</span><span>{ev.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
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
