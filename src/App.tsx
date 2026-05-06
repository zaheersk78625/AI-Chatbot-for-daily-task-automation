/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Mic, 
  MicOff, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  ListTodo, 
  Calendar,
  ExternalLink,
  Mail,
  User as UserIcon,
  LogOut,
  Plus,
  Pencil
} from 'lucide-react';
import { auth, signIn, signOut } from './lib/firebase';
import { taskService } from './services/taskService';
import { historyService } from './services/historyService';
import { geminiService } from './services/geminiService';
import { Task, ChatMessage } from './types';

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Filter tasks based on status
  const filteredTasks = tasks.filter(task => {
    if (taskFilter === 'all') return true;
    return task.status === taskFilter;
  });

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id!);
    setEditTitle(task.title);
  };

  const saveEdit = async (taskId: string) => {
    if (!editTitle.trim()) return;
    await taskService.updateTask(taskId, { title: editTitle });
    setEditingTaskId(null);
  };

  // Authentication
  useEffect(() => {
    return auth.onAuthStateChanged((u) => setUser(u));
  }, []);

  // Sync Tasks & History
  useEffect(() => {
    if (user) {
      const unsubTasks = taskService.subscribeToTasks(setTasks);
      const unsubHistory = historyService.subscribeToHistory(setMessages);
      return () => {
        unsubTasks();
        unsubHistory();
      };
    }
  }, [user]);

  // Scroll to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !user) return;

    const userInput = input;
    setInput('');
    setIsTyping(true);

    try {
      // Save user message to Firestore
      await historyService.saveMessage('user', userInput);

      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const response = await geminiService.processMessage(userInput, history);
      
      // Handle Function Calls
      if (response.functionCalls) {
        for (const call of response.functionCalls) {
          if (call.name === 'addTask') {
            await taskService.addTask(call.args as any);
          } else if (call.name === 'openWebsite') {
            window.open((call.args as any).url, '_blank');
          } else if (call.name === 'sendEmail') {
            const { to, subject, body } = call.args as any;
            window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          }
        }
      }

      const replyText = response.text || "Execution complete.";
      await historyService.saveMessage('model', replyText);

      if (response.text) {
        speak(response.text);
      }
    } catch (error) {
      console.error(error);
      await historyService.saveMessage('model', "I'm sorry, I encountered an error processing that request.");
    } finally {
      setIsTyping(false);
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.start();
  };

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("This domain is not authorized in Firebase. Please add it to 'Authorized Domains' in the Firebase Console.");
      } else {
        alert("Login failed: " + error.message);
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen aura-bg flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-2xl max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-900/20">
            <CheckCircle2 className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Aura</h1>
          <p className="text-gray-400 mb-8">Your intelligent task companion.</p>
          <button 
            onClick={handleSignIn}
            className="w-full bg-white text-black font-semibold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen aura-bg flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <div className="hidden md:flex flex-col w-64 glass-card border-r border-white/5">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl">Aura</span>
          </div>
          
          <nav className="space-y-2">
            <button 
              onClick={() => setShowTasks(false)}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${!showTasks ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Send size={18} /> Chat
            </button>
            <button 
              onClick={() => setShowTasks(true)}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${showTasks ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <ListTodo size={18} /> Tasks
              {tasks.length > 0 && (
                <span className="ml-auto bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                  {tasks.filter(t => t.status === 'pending').length}
                </span>
              )}
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 mb-4">
            <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-white/10" />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={signOut}
            className="w-full flex items-center gap-2 px-2 py-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative">
        <header className="md:hidden glass-card p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-blue-500 w-6 h-6" />
            <span className="font-bold">Aura</span>
          </div>
          <button onClick={() => setShowTasks(!showTasks)} className="p-2 bg-white/5 rounded-lg">
            {showTasks ? <Send size={20} /> : <ListTodo size={20} />}
          </button>
        </header>

        <AnimatePresence mode="wait">
          {!showTasks ? (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-4 md:p-8 custom-scrollbar overflow-y-auto"
            >
              <div className="max-w-3xl mx-auto w-full space-y-6 pb-24">
                {messages.length === 0 && (
                  <div className="text-center py-20">
                    <h2 className="text-2xl font-bold mb-4">Good morning, {user.displayName?.split(' ')[0]}</h2>
                    <p className="text-gray-500 max-w-sm mx-auto">
                      "Remind me to call Mom at 5 PM", "Add groceries to my to-do list", or "What's the weather like?"
                    </p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'glass-card border-none'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="glass-card p-4 rounded-2xl">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent">
                <form 
                  onSubmit={handleSend}
                  className="max-w-3xl mx-auto relative flex items-center gap-2"
                >
                  <div className="flex-1 relative">
                    <input 
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask Aura anything..."
                      className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 pl-6 pr-12 text-white focus:outline-none focus:border-blue-500/50 backdrop-blur-md transition-all"
                    />
                    <button 
                      type="button"
                      onClick={isListening ? () => {} : startListening}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                        isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                  </div>
                  <button 
                    type="submit"
                    className="p-4 bg-blue-600 rounded-2xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50"
                    disabled={!input.trim()}
                  >
                    <Send size={20} className="text-white" />
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 p-4 md:p-8 custom-scrollbar overflow-y-auto"
            >
              <div className="max-w-2xl mx-auto w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <ListTodo className="text-blue-500" /> Task History
                  </h2>
                  <div className="flex bg-white/5 p-1 rounded-xl glass-card border-none">
                    {(['pending', 'completed', 'all'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setTaskFilter(f)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                          taskFilter === f ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredTasks.length === 0 ? (
                    <div className="glass-card p-12 rounded-2xl text-center">
                      <Calendar className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                      <p className="text-gray-500">No {taskFilter !== 'all' ? taskFilter : ''} tasks found.</p>
                    </div>
                  ) : (
                    filteredTasks.map(task => (
                      <motion.div 
                        layout
                        key={task.id}
                        className={`glass-card p-4 rounded-xl flex items-center justify-between gap-4 group ${
                          task.status === 'completed' ? 'opacity-60 bg-white/[0.02]' : ''
                        }`}
                      >
                        <button 
                          onClick={() => taskService.updateTask(task.id!, { 
                            status: task.status === 'completed' ? 'pending' : 'completed' 
                          })}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            task.status === 'completed' 
                              ? 'bg-blue-600 border-blue-600' 
                              : 'border-white/20 hover:border-blue-500/50'
                          }`}
                        >
                          {task.status === 'completed' && <CheckCircle2 size={14} className="text-white" />}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          {editingTaskId === task.id ? (
                            <div className="flex items-center gap-2">
                              <input 
                                autoFocus
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={() => saveEdit(task.id!)}
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit(task.id!)}
                                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm w-full outline-none focus:border-blue-500"
                              />
                            </div>
                          ) : (
                            <p className={`font-medium truncate ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                              {task.title}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-1.5">
                            {task.dueDate && (
                              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                <Clock size={10} /> {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[10px] text-gray-600">
                              <Calendar size={10} /> {new Date(task.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {task.status !== 'completed' && (
                            <button 
                              onClick={() => startEditing(task)}
                              className="p-2 text-gray-500 hover:text-white"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          <button 
                            onClick={() => taskService.deleteTask(task.id!)}
                            className="p-2 text-gray-500 hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
