
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MoreHorizontal, Calendar, ArrowRight, AlertCircle, Layout, Tag, AlignLeft, Flag, Edit, Trash2, Upload, X, CheckSquare, User, Minus } from 'lucide-react';
import { useToasts } from './Toast';
import { UniversalModal } from './UniversalModal';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator } from './Dropdown';
import { ConfirmationBar } from './ConfirmationBar';
import { CustomSelect, CustomDatePicker } from './UIComponents';
import { saveAdminKanbanBoard, listenToAdminKanbanBoard } from '../services/database';
import { KanbanColumn as Column, KanbanTask as Task, KanbanChecklistItem } from '../types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';

const initialData: Column[] = [
    {
        id: 'todo',
        title: 'A Fazer',
        color: '#D97757', // Brand Color
        tasks: []
    },
    {
        id: 'in_progress',
        title: 'Em Progresso',
        color: '#3b82f6', // Blue
        tasks: []
    },
    {
        id: 'done',
        title: 'Concluído',
        color: '#10b981', // Emerald
        tasks: []
    }
];

export const AdminKanban: React.FC = () => {
    const [columns, setColumns] = useState<Column[]>(initialData);
    const [draggedTask, setDraggedTask] = useState<{ task: Task, sourceColId: string } | null>(null);
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

    // New/Edit Column Modal State
    const [isNewColumnModalOpen, setIsNewColumnModalOpen] = useState(false);
    const [editingColumnId, setEditingColumnId] = useState<string | null>(null); // Track if editing a specific column
    const [newColumnTitle, setNewColumnTitle] = useState('');
    const [newColumnColor, setNewColumnColor] = useState('#D97757');

    // Deletion State
    const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);

    // Visual State
    const [dragOverColId, setDragOverColId] = useState<string | null>(null);

    const toast = useToasts();

    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [newTaskColumnId, setNewTaskColumnId] = useState('todo');
    const [newTaskDate, setNewTaskDate] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);

    // Enhanced Task State
    const [editingTask, setEditingTask] = useState<{ task: Task, colId: string } | null>(null);
    const [viewingTask, setViewingTask] = useState<{ task: Task, colId: string } | null>(null);
    const [isViewTaskModalOpen, setIsViewTaskModalOpen] = useState(false);

    const [newTaskTags, setNewTaskTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState('');
    const [newTaskChecklist, setNewTaskChecklist] = useState<KanbanChecklistItem[]>([]);
    const [checklistInput, setChecklistInput] = useState('');

    // --- Persistence ---
    useEffect(() => {
        const unsubscribe = listenToAdminKanbanBoard((data) => {
            if (data && data.length > 0) {
                setColumns(data);
            } else {
                // If empty/first time, save initial data
                saveAdminKanbanBoard(initialData);
                setColumns(initialData);
            }
        });
        return () => unsubscribe();
    }, []);

    const updateColumns = (newCols: Column[]) => {
        setColumns(newCols);
        saveAdminKanbanBoard(newCols);
    };

    // --- Drag & Drop ---
    const handleDragStart = (task: Task, sourceColId: string) => {
        setDraggedTask({ task, sourceColId });
    };

    const handleDragOver = (e: React.DragEvent, colId: string) => {
        e.preventDefault();
        if (draggedTask && draggedTask.sourceColId !== colId) {
            setDragOverColId(colId);
        }
    };

    const handleDragLeave = () => {
        setDragOverColId(null);
    };

    const handleDrop = (targetColId: string) => {
        setDragOverColId(null);
        if (!draggedTask) return;
        const { task, sourceColId } = draggedTask;

        if (sourceColId === targetColId) return;

        const newColumns = columns.map(col => {
            if (col.id === sourceColId) {
                return { ...col, tasks: col.tasks.filter(t => t.id !== task.id) };
            }
            if (col.id === targetColId) {
                return { ...col, tasks: [...col.tasks, task] };
            }
            return col;
        });

        updateColumns(newColumns);
        setDraggedTask(null);
        toast.success(`Tarefa movida para ${columns.find(c => c.id === targetColId)?.title}`);
    };

    // --- Task Actions ---

    const handleCreateTask = async () => {
        if (!newTaskTitle.trim()) {
            toast.error('O título da tarefa é obrigatório.');
            return;
        }

        let imageUrl = '';
        if (selectedFile) {
            try {
                const storageRef = ref(storage, `kanban/${Date.now()}_${selectedFile.name}`);
                await uploadBytes(storageRef, selectedFile);
                imageUrl = await getDownloadURL(storageRef);
            } catch (error) {
                console.error("Error uploading image:", error);
                toast.error("Erro ao fazer upload da imagem.");
            }
        }

        const taskData: Task = {
            id: editingTask ? editingTask.task.id : crypto.randomUUID(),
            title: newTaskTitle,
            description: newTaskDescription,
            priority: newTaskPriority,
            dueDate: newTaskDate || undefined,
            tags: newTaskTags,
            imageUrl: imageUrl || (editingTask ? editingTask.task.imageUrl : undefined),
            assignee: newTaskAssignee || undefined,
            checklist: newTaskChecklist
        };

        let newColumns = [...columns];

        if (editingTask) {
            // Update Existing
            newColumns = newColumns.map(col => {
                // simple update mostly
                if (col.id === editingTask.colId) {
                    return {
                        ...col,
                        tasks: col.tasks.map(t => t.id === editingTask.task.id ? taskData : t)
                    };
                }
                // Handle column change if enabled
                if (col.id === newTaskColumnId && editingTask.colId !== newTaskColumnId) {
                    return { ...col, tasks: [...col.tasks, taskData] };
                }
                if (col.id === editingTask.colId && editingTask.colId !== newTaskColumnId) {
                    return { ...col, tasks: col.tasks.filter(t => t.id !== editingTask.task.id) };
                }
                return col;
            });
        } else {
            // Create New
            newColumns = columns.map(col => {
                const targetId = columns.find(c => c.id === newTaskColumnId) ? newTaskColumnId : columns[0].id;
                if (col.id === targetId) {
                    return { ...col, tasks: [...col.tasks, taskData] };
                }
                return col;
            });
        }

        updateColumns(newColumns);
        setIsNewTaskModalOpen(false);
        setEditingTask(null);
        toast.success(editingTask ? 'Tarefa atualizada!' : 'Tarefa criada com sucesso!');

        // Reset form
        resetTaskForm();
    };

    const resetTaskForm = () => {
        setNewTaskTitle('');
        setNewTaskDescription('');
        setNewTaskPriority('medium');
        setNewTaskDate('');
        setSelectedFile(null);
        setNewTaskTags([]);
        setNewTaskAssignee('');
        setNewTaskChecklist([]);
        setEditingTask(null);
    };

    const openEditTaskModal = (task: Task, colId: string) => {
        setEditingTask({ task, colId });
        setNewTaskTitle(task.title);
        setNewTaskDescription(task.description || '');
        setNewTaskPriority(task.priority);
        setNewTaskColumnId(colId); // Lock column or allow change
        setNewTaskDate(task.dueDate || '');
        setNewTaskTags(task.tags || []);
        setNewTaskAssignee(task.assignee || '');
        setNewTaskChecklist(task.checklist || []);
        setSelectedFile(null); // Reset file input, current img handled by logic
        setIsNewTaskModalOpen(true);
    };

    const openViewTaskModal = (task: Task, colId: string) => {
        setViewingTask({ task, colId });
        setIsViewTaskModalOpen(true);
    };

    const handleToggleChecklistFromView = (taskId: string, colId: string, itemId: string) => {
        const newColumns = columns.map(col => {
            if (col.id === colId) {
                return {
                    ...col,
                    tasks: col.tasks.map(t => {
                        if (t.id === taskId && t.checklist) {
                            return {
                                ...t,
                                checklist: t.checklist.map(item =>
                                    item.id === itemId ? { ...item, completed: !item.completed } : item
                                )
                            };
                        }
                        return t;
                    })
                };
            }
            return col;
        });

        // Update local state for immediate feedback in modal if it breaks reference (though usually reference update updates View)
        // Better to update View state too or let it sync from Columns if derived.
        // Assuming viewingTask is just a snapshot, we need to update it too or the modal won't blink.
        // Actually, let's update columns and sync viewingTask.
        const updatedTask = newColumns.find(c => c.id === colId)?.tasks.find(t => t.id === taskId);
        if (updatedTask && viewingTask) {
            setViewingTask({ task: updatedTask, colId });
        }

        updateColumns(newColumns);
    };

    const handleAddChecklistItem = () => {
        if (!checklistInput.trim()) return;
        setNewTaskChecklist([...newTaskChecklist, { id: crypto.randomUUID(), text: checklistInput, completed: false }]);
        setChecklistInput('');
    };

    const toggleChecklistItem = (id: string) => {
        setNewTaskChecklist(newTaskChecklist.map(item =>
            item.id === id ? { ...item, completed: !item.completed } : item
        ));
    };

    const removeChecklistItem = (id: string) => {
        setNewTaskChecklist(newTaskChecklist.filter(item => item.id !== id));
    };

    const handleAddTag = () => {
        if (!tagInput.trim()) return;
        if (!newTaskTags.includes(tagInput.trim())) {
            setNewTaskTags([...newTaskTags, tagInput.trim()]);
        }
        setTagInput('');
    };

    const removeTag = (tag: string) => {
        setNewTaskTags(newTaskTags.filter(t => t !== tag));
    };

    const deleteTask = (taskId: string, colId: string) => {
        updateColumns(columns.map(c => {
            if (c.id === colId) {
                return { ...c, tasks: c.tasks.filter(t => t.id !== taskId) };
            }
            return c;
        }));
        toast.success('Tarefa excluída.');
    };

    // --- Column Actions ---
    const openAddColumnModal = () => {
        setEditingColumnId(null);
        setNewColumnTitle('');
        setNewColumnColor('#D97757');
        setIsNewColumnModalOpen(true);
    };

    const openEditColumnModal = (col: Column) => {
        setEditingColumnId(col.id);
        setNewColumnTitle(col.title);
        setNewColumnColor(col.color);
        setIsNewColumnModalOpen(true);
    };

    const handleSaveColumn = () => {
        if (!newColumnTitle.trim()) {
            toast.error("O título da coluna é obrigatório.");
            return;
        }

        if (editingColumnId) {
            // Update existing
            updateColumns(columns.map(col => {
                if (col.id === editingColumnId) {
                    return { ...col, title: newColumnTitle, color: newColumnColor };
                }
                return col;
            }));
            toast.success("Coluna atualizada!");
        } else {
            // Create new
            const newColumn: Column = {
                id: crypto.randomUUID(),
                title: newColumnTitle,
                color: newColumnColor,
                tasks: []
            };
            updateColumns([...columns, newColumn]);
            toast.success("Coluna adicionada com sucesso!");
        }

        setIsNewColumnModalOpen(false);
        setNewColumnTitle('');
        setEditingColumnId(null);
    };

    const confirmDeleteColumn = () => {
        if (deleteColumnId) {
            updateColumns(columns.filter(c => c.id !== deleteColumnId));
            toast.success("Coluna excluída.");
            setDeleteColumnId(null);
        }
    };

    const handleClearColumn = (colId: string) => {
        if (confirm("Limpar todas as tarefas desta coluna?")) {
            updateColumns(columns.map(c => {
                if (c.id === colId) return { ...c, tasks: [] };
                return c;
            }));
            toast.success("Tarefas limpas.");
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-500/20 text-red-500 border-red-500/30';
            case 'medium': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
            case 'low': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
            default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden p-2 lg:p-4 gap-4">
            <header className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">Kanban Controlar+</h1>
                    <p className="text-gray-400 text-sm">Gerencie tarefas e acompanhe o progresso da equipe</p>
                </div>
                <button
                    onClick={() => {
                        resetTaskForm();
                        setIsNewTaskModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-[#D97757] hover:bg-[#c5664a] text-white px-4 py-2 rounded-xl transition-all font-medium shadow-lg shadow-[#D97757]/20"
                >
                    <Plus size={18} />
                    <span>Nova Tarefa</span>
                </button>
            </header>

            <div className="flex gap-6 h-full overflow-x-auto pb-4 items-start no-scrollbar">
                <AnimatePresence mode="popLayout">
                    {columns.map(col => (
                        <div
                            key={col.id}
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={() => handleDrop(col.id)}
                            className={`min-w-[320px] w-[320px] shrink-0 flex flex-col gap-4 bg-[#30302E] border rounded-2xl p-4 h-full max-h-full transition-all duration-300 ${dragOverColId === col.id ? 'border-[#D97757] bg-[#D97757]/5 shadow-[0_0_30px_rgba(217,119,87,0.1)]' : 'border-[#373734]'}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: col.color }} />
                                    <h3 className="font-bold text-gray-200">{col.title}</h3>
                                    <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full border border-gray-700">{col.tasks.length}</span>
                                </div>
                                <Dropdown>
                                    <DropdownTrigger className="text-gray-500 hover:text-white transition-colors p-1 rounded-md hover:bg-[#373734]">
                                        <MoreHorizontal size={18} />
                                    </DropdownTrigger>
                                    <DropdownContent align="right">
                                        <DropdownItem icon={Edit} onClick={() => openEditColumnModal(col)}>
                                            Renomear / Editar
                                        </DropdownItem>
                                        <DropdownItem icon={Trash2} onClick={() => handleClearColumn(col.id)}>
                                            Limpar Tarefas
                                        </DropdownItem>
                                        <DropdownSeparator />
                                        <DropdownItem icon={Trash2} danger onClick={() => setDeleteColumnId(col.id)}>
                                            Excluir Coluna
                                        </DropdownItem>
                                    </DropdownContent>
                                </Dropdown>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 min-h-[100px] p-2 -m-2">
                                {col.tasks.map(task => (
                                    <motion.div
                                        layout
                                        layoutId={task.id}
                                        key={task.id}
                                        draggable
                                        onDragStart={() => handleDragStart(task, col.id)}
                                        onClick={() => openViewTaskModal(task, col.id)}
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.90, transition: { duration: 0.2 } }}
                                        whileHover={{ scale: 1.03, rotate: 1, zIndex: 10, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                                        whileTap={{ scale: 0.98 }}
                                        transition={{
                                            layout: { type: "spring", stiffness: 350, damping: 25 },
                                            opacity: { duration: 0.2 }
                                        }}
                                        className={`bg-[#373734]/50 p-4 rounded-xl border border-transparent hover:border-[#454543] hover:bg-[#373734] cursor-pointer active:cursor-grabbing shadow-sm group flex flex-col gap-3 transition-colors relative ${draggedTask?.task.id === task.id ? 'opacity-30 grayscale border-dashed border-gray-600' : ''}`}
                                    >
                                        {task.imageUrl && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); setExpandedImage(task.imageUrl || null); }}
                                                className="w-full h-32 mb-2 rounded-lg overflow-hidden bg-gray-900/50 relative cursor-zoom-in group/image"
                                            >
                                                <img
                                                    src={task.imageUrl}
                                                    alt="Task Attachment"
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover/image:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/image:opacity-100">
                                                    <div className="bg-black/50 p-2 rounded-full text-white backdrop-blur-sm">
                                                        <Plus size={16} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-start gap-2">
                                            <h4 className="text-gray-200 font-medium text-sm leading-snug w-full pr-6">{task.title}</h4>

                                            <div
                                                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Dropdown>
                                                    <DropdownTrigger className="text-gray-500 hover:text-white p-1 rounded hover:bg-black/20">
                                                        <MoreHorizontal size={14} />
                                                    </DropdownTrigger>
                                                    <DropdownContent width="w-40">
                                                        <DropdownItem icon={Edit} onClick={() => openEditTaskModal(task, col.id)}>
                                                            Editar
                                                        </DropdownItem>
                                                        <DropdownItem icon={Trash2} danger onClick={() => deleteTask(task.id, col.id)}>
                                                            Excluir
                                                        </DropdownItem>
                                                    </DropdownContent>
                                                </Dropdown>
                                            </div>
                                        </div>

                                        {task.description && (
                                            <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                                        )}

                                        <div className="flex items-center gap-2 flex-wrap mt-auto pt-2">
                                            {/* Priority Badge */}
                                            <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wide ${getPriorityColor(task.priority)}`}>
                                                {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                                            </span>

                                            {/* Due Date */}
                                            {task.dueDate && (
                                                <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700">
                                                    <Calendar size={10} />
                                                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                                </div>
                                            )}

                                            {/* Checklist Progress */}
                                            {task.checklist && task.checklist.length > 0 && (
                                                <div className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700">
                                                    <CheckSquare size={10} />
                                                    <span>{task.checklist.filter(i => i.completed).length}/{task.checklist.length}</span>
                                                </div>
                                            )}

                                            {/* Assignee */}
                                            {task.assignee && (
                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-[10px] text-white font-bold border border-white/10" title={task.assignee}>
                                                    {task.assignee.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Tags Row */}
                                        {task.tags && task.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {task.tags.map((tag, i) => (
                                                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#454543] text-gray-300 border border-[#50504e]">
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                                {col.tasks.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-10 text-gray-600 border-2 border-dashed border-[#373734] rounded-xl">
                                        <div className="p-3 bg-[#373734]/50 rounded-full mb-3">
                                            <ArrowRight size={16} className="text-gray-500" />
                                        </div>
                                        <p className="text-sm font-medium">Solte aqui</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    resetTaskForm();
                                    setNewTaskColumnId(col.id);
                                    setIsNewTaskModalOpen(true);
                                }}
                                className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#373734] text-gray-500 hover:text-white hover:border-gray-500 hover:bg-[#373734]/30 transition-all text-sm group shrink-0"
                            >
                                <Plus size={16} className="group-hover:scale-110 transition-transform" />
                                Adicionar item
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={openAddColumnModal}
                        className="min-w-[320px] h-[60px] flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#373734] text-gray-500 hover:text-white hover:border-gray-500 hover:bg-[#30302E] transition-all shrink-0"
                    >
                        <Plus size={20} />
                        <span className="font-medium">Adicionar Coluna</span>
                    </button>
                </AnimatePresence>
            </div>

            {/* Modal de Nova Tarefa */}
            <UniversalModal
                isOpen={isNewTaskModalOpen}
                onClose={() => setIsNewTaskModalOpen(false)}
                title={editingTask ? "Editar Tarefa" : "Criar Nova Tarefa"}
                width="max-w-xl"
                themeColor="#D97757"
                icon={<Layout size={20} />}
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsNewTaskModalOpen(false)}
                            className="px-4 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreateTask}
                            className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#c5664a] text-white text-sm font-bold shadow-lg shadow-[#D97757]/20 transition-all"
                        >
                            {editingTask ? "Salvar Alterações" : "Criar Tarefa"}
                        </button>
                    </div>
                }
            >
                {/* Form Content same as before */}
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                            <Tag size={12} />
                            Título
                        </label>
                        <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Ex: Implementar nova feature..."
                            className="w-full bg-[#373734] border border-[#454543] rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#D97757] transition-all"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                            <AlignLeft size={12} />
                            Descrição
                        </label>
                        <textarea
                            value={newTaskDescription}
                            onChange={(e) => setNewTaskDescription(e.target.value)}
                            placeholder="Detalhes da tarefa..."
                            rows={3}
                            className="w-full bg-[#373734] border border-[#454543] rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#D97757] transition-all resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                                <Flag size={12} />
                                Prioridade
                            </label>
                            <div className="flex bg-[#373734] rounded-xl p-1 border border-[#454543]">
                                {[
                                    { value: 'low', label: 'Baixa', color: 'hover:text-blue-400' },
                                    { value: 'medium', label: 'Média', color: 'hover:text-yellow-400' },
                                    { value: 'high', label: 'Alta', color: 'hover:text-red-400' }
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setNewTaskPriority(opt.value as any)}
                                        className={`
                                            flex-1 text-xs font-bold py-1.5 rounded-lg transition-all
                                            ${newTaskPriority === opt.value
                                                ? 'bg-[#454543] text-white shadow-sm'
                                                : `text-gray-500 ${opt.color}`
                                            }
                                        `}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                                <Layout size={12} />
                                Coluna
                            </label>
                            <CustomSelect
                                value={newTaskColumnId}
                                onChange={(val) => setNewTaskColumnId(val)}
                                options={columns.map(col => ({ value: col.id, label: col.title }))}
                                placeholder="Selecione a coluna"
                                portal={true}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Assignee */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                                <User size={12} />
                                Responsável
                            </label>
                            <CustomSelect
                                value={newTaskAssignee}
                                onChange={setNewTaskAssignee}
                                options={[
                                    { value: 'Admin', label: 'Admin Principal' },
                                    { value: 'Dev', label: 'Desenvolvedor' },
                                    { value: 'Design', label: 'Designer' },
                                    { value: 'Support', label: 'Suporte' }
                                ]}
                                placeholder="Selecionar..."
                                portal={true}
                            />
                        </div>
                        {/* Tags Input */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                                <Tag size={12} />
                                Etiquetas (Enter)
                            </label>
                            <div className="bg-[#373734] border border-[#454543] rounded-xl px-2 py-1.5 text-white flex flex-wrap gap-2 items-center focus-within:border-[#D97757] transition-all">
                                {newTaskTags.map(tag => (
                                    <span key={tag} className="bg-[#454543] text-xs px-1.5 py-0.5 rounded flex items-center gap-1 border border-gray-600">
                                        {tag}
                                        <button onClick={() => removeTag(tag)} className="hover:text-red-400"><X size={10} /></button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddTag();
                                        }
                                    }}
                                    className="bg-transparent outline-none flex-1 text-sm min-w-[60px]"
                                    placeholder={newTaskTags.length === 0 ? "Ex: Bug..." : ""}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Checklist Section */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                            <CheckSquare size={12} />
                            Checklist (Subtarefas)
                        </label>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={checklistInput}
                                    onChange={(e) => setChecklistInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddChecklistItem();
                                        }
                                    }}
                                    className="flex-1 bg-[#373734] border border-[#454543] rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#D97757] text-sm"
                                    placeholder="Adicionar item..."
                                />
                                <button
                                    onClick={handleAddChecklistItem}
                                    className="bg-[#373734] hover:bg-[#454543] text-white p-2 rounded-xl border border-[#454543] transition-colors"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            <div className="space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                {newTaskChecklist.map(item => (
                                    <div key={item.id} className="flex items-center gap-2 bg-[#30302E] p-2 rounded-lg border border-[#373734] group">
                                        <button
                                            onClick={() => toggleChecklistItem(item.id)}
                                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${item.completed ? 'bg-green-500/20 border-green-500 text-green-500' : 'border-gray-600 text-transparent hover:border-gray-400'}`}
                                        >
                                            <CheckSquare size={12} />
                                        </button>
                                        <span className={`text-sm flex-1 ${item.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{item.text}</span>
                                        <button onClick={() => removeChecklistItem(item.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Minus size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                            <Upload size={12} />
                            Imagem (Opcional)
                        </label>
                        {!selectedFile ? (
                            <label className="block w-full cursor-pointer">
                                <div className="bg-[#373734] border border-[#454543] border-dashed rounded-xl p-4 text-center hover:border-[#D97757] transition-colors group">
                                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-[#D97757]/10 group-hover:text-[#D97757] transition-colors text-gray-500">
                                        <Upload size={16} />
                                    </div>
                                    <p className="text-xs font-medium text-gray-300">Clique para enviar imagem</p>
                                    <p className="text-[10px] text-gray-500 mt-1">PNG, JPG ou GIF (max. 2MB)</p>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            if (file.size > 2 * 1024 * 1024) {
                                                toast.error('Imagem muito grande. Máximo 2MB.');
                                                return;
                                            }
                                            setSelectedFile(file);
                                        }
                                    }}
                                />
                            </label>
                        ) : (
                            <div className="relative w-full rounded-xl overflow-hidden border border-[#454543] bg-[#373734] group">
                                <div className="h-32 w-full relative">
                                    <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setSelectedFile(null)}
                                            className="bg-red-500/90 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-red-500 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all"
                                        >
                                            <Trash2 size={14} /> Remover
                                        </button>
                                    </div>
                                </div>
                                <div className="px-3 py-2 bg-gray-900/50 border-t border-[#454543] flex justify-between items-center">
                                    <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{selectedFile.name}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                            <Calendar size={12} />
                            Prazo (Opcional)
                        </label>
                        <CustomDatePicker
                            value={newTaskDate}
                            onChange={(val) => setNewTaskDate(val)}
                            dropdownMode="fixed"
                        />
                    </div>
                </div>
            </UniversalModal>

            {/* Modal de Nova/Edit Coluna */}
            <UniversalModal
                isOpen={isNewColumnModalOpen}
                onClose={() => setIsNewColumnModalOpen(false)}
                title={editingColumnId ? "Editar Coluna" : "Adicionar Coluna"}
                width="max-w-md"
                themeColor="#D97757" // Brand Orange
                icon={<Layout size={20} />}
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsNewColumnModalOpen(false)}
                            className="px-4 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveColumn}
                            className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#c5664a] text-white text-sm font-bold shadow-lg shadow-[#D97757]/20 transition-all"
                        >
                            {editingColumnId ? "Salvar Alterações" : "Criar Coluna"}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                            Nome da Coluna
                        </label>
                        <input
                            type="text"
                            value={newColumnTitle}
                            onChange={(e) => setNewColumnTitle(e.target.value)}
                            placeholder="Ex: Em revisão..."
                            className="w-full bg-[#373734] border border-[#454543] rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#D97757] transition-all"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                            Cor da Tag
                        </label>
                        <div className="flex gap-2">
                            {['#D97757', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map(color => (
                                <button
                                    key={color}
                                    onClick={() => setNewColumnColor(color)}
                                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${newColumnColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </UniversalModal>

            {/* Delete Confirmation Bar */}
            <ConfirmationBar
                isOpen={!!deleteColumnId}
                onCancel={() => setDeleteColumnId(null)}
                onConfirm={confirmDeleteColumn}
                label="Excluir esta coluna e suas tarefas?"
                confirmText="Sim, excluir"
                cancelText="Cancelar"
                isDestructive={true}
                position="bottom"
            />
            {/* Modal de Visualização (View Mode) */}
            <UniversalModal
                isOpen={isViewTaskModalOpen}
                onClose={() => setIsViewTaskModalOpen(false)}
                title="Detalhes da Tarefa"
                width="max-w-2xl"
                themeColor="#D97757"
                icon={<Layout size={20} />}
                footer={
                    <div className="flex justify-between w-full">
                        <button
                            onClick={() => {
                                setIsViewTaskModalOpen(false);
                                if (viewingTask) deleteTask(viewingTask.task.id, viewingTask.colId);
                            }}
                            className="bg-transparent hover:bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Trash2 size={16} /> Excluir
                        </button>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsViewTaskModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm font-medium"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={() => {
                                    if (viewingTask) {
                                        setIsViewTaskModalOpen(false);
                                        openEditTaskModal(viewingTask.task, viewingTask.colId);
                                    }
                                }}
                                className="px-4 py-2 rounded-xl bg-[#373734] hover:bg-[#454543] text-white text-sm font-bold border border-[#454543] flex items-center gap-2"
                            >
                                <Edit size={16} /> Editar
                            </button>
                        </div>
                    </div>
                }
            >
                {viewingTask && (
                    <div className="space-y-6">
                        {/* Header Info */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start justify-between gap-4">
                                <h2 className="text-xl font-bold text-white leading-snug">{viewingTask.task.title}</h2>
                                {viewingTask.task.priority && (
                                    <span className={`text-xs px-2.5 py-1 rounded-lg border uppercase font-bold tracking-wide shrink-0 ${getPriorityColor(viewingTask.task.priority)}`}>
                                        {viewingTask.task.priority === 'high' ? 'Alta Prioridade' : viewingTask.task.priority === 'medium' ? 'Média Prioridade' : 'Baixa Prioridade'}
                                    </span>
                                )}
                            </div>

                            {/* Metadata Row */}
                            <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                                {viewingTask.task.assignee && (
                                    <div className="flex items-center gap-2 bg-[#30302E] px-3 py-1.5 rounded-lg border border-[#373734]">
                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">
                                            {viewingTask.task.assignee.charAt(0).toUpperCase()}
                                        </div>
                                        <span>{viewingTask.task.assignee}</span>
                                    </div>
                                )}
                                {viewingTask.task.dueDate && (
                                    <div className="flex items-center gap-2 bg-[#30302E] px-3 py-1.5 rounded-lg border border-[#373734]">
                                        <Calendar size={14} />
                                        <span>{new Date(viewingTask.task.dueDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 bg-[#30302E] px-3 py-1.5 rounded-lg border border-[#373734]">
                                    <Layout size={14} />
                                    <span>{columns.find(c => c.id === viewingTask.colId)?.title}</span>
                                </div>
                            </div>
                        </div>

                        {/* Image */}
                        {viewingTask.task.imageUrl && (
                            <div
                                onClick={() => setExpandedImage(viewingTask.task.imageUrl || null)}
                                className="w-full h-48 rounded-xl overflow-hidden bg-gray-900/50 relative cursor-zoom-in border border-[#373734] group"
                            >
                                <img
                                    src={viewingTask.task.imageUrl}
                                    alt="Task Attachment"
                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                />
                            </div>
                        )}

                        {/* Description */}
                        {viewingTask.task.description && (
                            <div className="bg-[#30302E] p-4 rounded-xl border border-[#373734]">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <AlignLeft size={14} /> Descrição
                                </h3>
                                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{viewingTask.task.description}</p>
                            </div>
                        )}

                        {/* Checklist - Interactive */}
                        {(viewingTask.task.checklist && viewingTask.task.checklist.length > 0) ? (
                            <div className="bg-[#30302E] p-4 rounded-xl border border-[#373734]">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <CheckSquare size={14} />
                                    Checklist ({viewingTask.task.checklist.filter(i => i.completed).length}/{viewingTask.task.checklist.length})
                                </h3>
                                <div className="space-y-2">
                                    {viewingTask.task.checklist.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleToggleChecklistFromView(viewingTask.task.id, viewingTask.colId, item.id)}
                                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#373734] cursor-pointer transition-colors group"
                                        >
                                            <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${item.completed ? 'bg-green-500 border-green-500 text-black' : 'border-gray-600 group-hover:border-gray-400'}`}>
                                                {item.completed && <CheckSquare size={14} />}
                                            </div>
                                            <span className={`text-sm leading-snug transition-colors ${item.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                                {item.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {/* Tags */}
                        {viewingTask.task.tags && viewingTask.task.tags.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Tag size={14} /> Etiquetas
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {viewingTask.task.tags.map((tag, i) => (
                                        <span key={i} className="text-xs px-2 py-1 rounded-lg bg-[#454543] text-gray-200 border border-[#50504e]">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </UniversalModal>

            {/* Image Expansion Lightbox */}
            <AnimatePresence>
                {expandedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setExpandedImage(null)}
                        className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
                    >
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            src={expandedImage}
                            alt="Expanded Task"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setExpandedImage(null)}
                            className="absolute top-6 right-6 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md"
                        >
                            <X size={24} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
