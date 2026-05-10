import React, { useState, useEffect } from 'react';
import { db } from './lib/firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { 
  format, 
  addDays, 
  startOfWeek, 
  eachDayOfInterval,
  isSameDay
} from 'date-fns';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Clock,
  Edit2,
  ListTodo
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Task {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  failed: boolean;
  actualContent?: string;
  actualTime?: string;
  delayCount: number;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showWeekly, setShowWeekly] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    actualContent: '',
    actualTime: ''
  });

  // Sync with Firebase
  useEffect(() => {
    const tasksRef = ref(db, 'tasks');
    return onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const taskList = Object.entries(data).map(([id, val]: [string, any]) => ({
          ...val,
          id
        }));
        setTasks(taskList);
      } else {
        setTasks([]);
      }
    });
  }, []);

  // 14:00 Auto-fail and Carry-over Logic
  useEffect(() => {
    const checkCarryOver = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const todayStr = format(now, 'yyyy-MM-dd');
      
      // If it's after 14:00
      if (currentHour >= 14) {
        const tasksToMove = tasks.filter(t => 
          t.date === todayStr && 
          !t.completed && 
          !t.failed
        );

        tasksToMove.forEach(task => {
          const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
          
          // Mark current as failed
          update(ref(db, `tasks/${task.id}`), { failed: true });

          // Create new task for tomorrow
          const newTask = {
            ...task,
            id: undefined, // Let Firebase generate new ID
            date: tomorrow,
            failed: false,
            completed: false,
            delayCount: (task.delayCount || 0) + 1,
            title: task.title.startsWith('[已推迟') 
              ? task.title.replace(/\[已推迟\d+天\]/, `[已推迟${(task.delayCount || 0) + 1}天]`)
              : `[已推迟1天] ${task.title}`
          };
          delete (newTask as any).id;
          push(ref(db, 'tasks'), newTask);
        });
      }
    };

    const interval = setInterval(checkCarryOver, 60000); // Check every minute
    checkCarryOver(); // Initial check
    return () => clearInterval(interval);
  }, [tasks]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const newTask = {
      title: formData.title,
      startTime: formData.startTime,
      endTime: formData.endTime,
      date: format(selectedDate, 'yyyy-MM-dd'),
      completed: false,
      failed: false,
      delayCount: 0
    };
    push(ref(db, 'tasks'), newTask);
    setIsAdding(false);
    resetForm();
  };

  const handleUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    update(ref(db, `tasks/${editingTask.id}`), {
      title: formData.title,
      startTime: formData.startTime,
      endTime: formData.endTime,
    });
    setEditingTask(null);
    resetForm();
  };

  const handleCompleteTask = (task: Task) => {
    if (task.completed) {
      update(ref(db, `tasks/${task.id}`), { 
        completed: false, 
        actualContent: null, 
        actualTime: null 
      });
    } else {
      setEditingTask({ ...task, completed: true });
      setFormData({
        ...formData,
        actualContent: '',
        actualTime: ''
      });
    }
  };

  const submitCompletion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    update(ref(db, `tasks/${editingTask.id}`), {
      completed: true,
      actualContent: formData.actualContent,
      actualTime: formData.actualTime
    });
    setEditingTask(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      title: '',
      startTime: '09:00',
      endTime: '10:00',
      actualContent: '',
      actualTime: ''
    });
  };

  const deleteTask = (id: string) => {
    if (confirm('确定要删除吗？')) {
      remove(ref(db, `tasks/${id}`));
    }
  };

  const filteredTasks = tasks.filter(t => t.date === format(selectedDate, 'yyyy-MM-dd'));
  
  // Weekly Overview Data
  const startOfCurrWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: startOfCurrWeek,
    end: addDays(startOfCurrWeek, 6)
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
          <ListTodo size={24} />
          周计划助手
        </h1>
        <button 
          onClick={() => setShowWeekly(!showWeekly)}
          className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"
        >
          <Calendar size={16} />
          {showWeekly ? '返回日程' : '周总览'}
        </button>
      </header>

      {!showWeekly ? (
        <main className="p-4 max-w-md mx-auto">
          {/* Date Selector */}
          <div className="flex items-center justify-between mb-6 bg-white p-2 rounded-xl shadow-sm">
            <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <div className="text-sm text-gray-500">{format(selectedDate, 'yyyy年MM月')}</div>
              <div className="font-bold">{format(selectedDate, 'dd日')} 周{['日','一','二','三','四','五','六'][selectedDate.getDay()]}</div>
            </div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                今天还没有任务，点击下方“+”添加
              </div>
            ) : (
              filteredTasks.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(task => (
                <div 
                  key={task.id} 
                  className={cn(
                    "bg-white p-4 rounded-2xl shadow-sm border-l-4 transition-all",
                    task.completed ? "border-green-500 opacity-75" : task.failed ? "border-red-400 opacity-60" : "border-indigo-500"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-gray-400" />
                        <span className="text-xs font-mono text-gray-500">{task.startTime} - {task.endTime}</span>
                        {task.failed && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">未完成推迟</span>}
                      </div>
                      <h3 className={cn("font-semibold text-lg leading-tight", task.completed && "line-through text-gray-400")}>
                        {task.title}
                      </h3>
                      {task.completed && task.actualContent && (
                        <div className="mt-2 bg-green-50 p-2 rounded text-sm text-green-800">
                          <div className="font-medium flex items-center gap-1"><CheckCircle2 size={14}/> 实际完成：</div>
                          <div>{task.actualContent}</div>
                          <div className="text-xs text-green-600 mt-1 italic">耗时：{task.actualTime}</div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleCompleteTask(task)}
                        className={cn("p-2 rounded-full", task.completed ? "text-green-500" : "text-gray-300 hover:text-indigo-500")}
                      >
                        {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t flex justify-end gap-3">
                    <button onClick={() => {
                      setEditingTask(task);
                      setFormData({
                        title: task.title,
                        startTime: task.startTime,
                        endTime: task.endTime,
                        actualContent: task.actualContent || '',
                        actualTime: task.actualTime || ''
                      });
                    }} className="text-gray-400 hover:text-indigo-600 text-sm flex items-center gap-1">
                      <Edit2 size={14} /> 修改
                    </button>
                    <button onClick={() => deleteTask(task.id)} className="text-gray-400 hover:text-red-500 text-sm flex items-center gap-1">
                      <Trash2 size={14} /> 删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      ) : (
        /* Weekly View */
        <main className="p-4 max-w-2xl mx-auto space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2 px-2">
            <Calendar size={20} className="text-indigo-600" />
            本周任务总览
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {weekDays.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayTasks = tasks.filter(t => t.date === dayStr);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div key={dayStr} className={cn("bg-white p-4 rounded-2xl shadow-sm border", isToday && "ring-2 ring-indigo-500")}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold">
                      {format(day, 'MM-dd')} 周{['日','一','二','三','四','五','六'][day.getDay()]}
                    </h3>
                    {isToday && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full">今天</span>}
                  </div>
                  <div className="space-y-1.5">
                    {dayTasks.length === 0 ? (
                      <div className="text-xs text-gray-300 italic">暂无任务</div>
                    ) : (
                      dayTasks.map(t => (
                        <div key={t.id} className="text-sm flex items-center gap-2 text-gray-600 truncate">
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", t.completed ? "bg-green-500" : t.failed ? "bg-red-400" : "bg-indigo-300")} />
                          <span className={cn(t.completed && "line-through text-gray-400")}>{t.title}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* Floating Add Button */}
      {!showWeekly && (
        <button 
          onClick={() => {
            setIsAdding(true);
            resetForm();
          }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-transform active:scale-95"
        >
          <Plus size={32} />
        </button>
      )}

      {/* Add/Edit Modal */}
      {(isAdding || (editingTask && !editingTask.completed)) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{isAdding ? '添加新任务' : '修改任务'}</h2>
              <button onClick={() => { setIsAdding(false); setEditingTask(null); }} className="text-gray-400">取消</button>
            </div>
            <form onSubmit={isAdding ? handleAddTask : handleUpdateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">任务内容</label>
                <input 
                  type="text" 
                  required
                  placeholder="要做什么？"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                  <input 
                    type="time" 
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                  <input 
                    type="time" 
                    value={formData.endTime}
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold mt-4 shadow-lg shadow-indigo-200">
                保存任务
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {editingTask && editingTask.completed && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-green-600 flex items-center gap-2">
                <CheckCircle2 size={24} /> 完成任务确认
              </h2>
            </div>
            <form onSubmit={submitCompletion} className="space-y-4">
              <p className="text-gray-500 mb-2 font-medium">任务：{editingTask.title}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">实际完成内容</label>
                <textarea 
                  rows={3}
                  placeholder="简单记录下完成情况..."
                  value={formData.actualContent}
                  onChange={e => setFormData({...formData, actualContent: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">实际所用时间</label>
                <input 
                  type="text" 
                  placeholder="例如：45分钟 / 1.5小时"
                  value={formData.actualTime}
                  onChange={e => setFormData({...formData, actualTime: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold mt-4 shadow-lg shadow-green-200">
                确认打勾
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setEditingTask(null);
                  resetForm();
                }} 
                className="w-full text-gray-400 py-2"
              >
                取消
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
