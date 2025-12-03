
import React from 'react';
import { 
  LayoutDashboard, 
  Table2, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Sparkles, 
  Search, 
  Menu, 
  X,
  Bot, 
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  User,
  LogOut,
  PieChart,
  HelpCircle,
  // Category Icons
  Utensils,
  Car,
  Home,
  Gamepad2,
  Heart,
  Banknote,
  Zap,
  ShoppingBag,
  Briefcase,
  GraduationCap,
  Plane,
  Calendar,
  Filter,
  Check,
  DollarSign,
  Tag,
  Mail,
  Lock,
  UserCircle,
  Shield,
  ShieldCheck,
  Bell,
  Clock,
  AlertCircle,
  CalendarClock,
  Coins,
  Edit2,
  Save,
  PlusCircle,
  Calculator,
  BrainCircuit,
  Lightbulb,
  Target,
  MessageSquare,
  FileText,
  ArrowRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Users,
  Crown,
  Trophy,
  Star,
  Smartphone,
  UploadCloud,
  LineChart,
  Quote,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  Send,
  Link,
  Landmark,
  ScanLine,
  Image as ImageIcon,
  QrCode,
  Building,
  RotateCcw,
  CreditCard,
  Download,
  Upload,
  Copy,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  UserPlus
} from 'lucide-react';

// Helper to get icon based on category
export const getCategoryIcon = (category: string, size: number = 16) => {
  // FIX: Safety check to prevent crash if category is undefined/null
  const normalized = (category || "").toLowerCase();
  
  if (normalized.includes('aliment') || normalized.includes('comida') || normalized.includes('restaurante')) return <Utensils size={size} />;
  if (normalized.includes('transport') || normalized.includes('uber') || normalized.includes('gasolina')) return <Car size={size} />;
  if (normalized.includes('moradia') || normalized.includes('casa') || normalized.includes('aluguel') || normalized.includes('luz')) return <Home size={size} />;
  if (normalized.includes('lazer') || normalized.includes('jogo') || normalized.includes('cinema')) return <Gamepad2 size={size} />;
  if (normalized.includes('saúde') || normalized.includes('medico') || normalized.includes('farmacia')) return <Heart size={size} />;
  if (normalized.includes('salário') || normalized.includes('renda') || normalized.includes('freela')) return <Banknote size={size} />;
  if (normalized.includes('investimento')) return <TrendingUp size={size} />;
  if (normalized.includes('educação') || normalized.includes('curso')) return <GraduationCap size={size} />;
  if (normalized.includes('viagem')) return <Plane size={size} />;
  if (normalized.includes('compra') || normalized.includes('shopping')) return <ShoppingBag size={size} />;
  if (normalized.includes('trabalho') || normalized.includes('extra')) return <Briefcase size={size} />;
  
  return <Zap size={size} />; // Default
};

export { 
  LayoutDashboard, 
  Table2, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Sparkles, 
  Search, 
  Menu, 
  X,
  Bot, 
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  User,
  LogOut,
  PieChart,
  HelpCircle,
  Utensils,
  Car,
  Home,
  Gamepad2,
  Heart,
  Banknote,
  Zap,
  ShoppingBag,
  Briefcase,
  GraduationCap,
  Plane,
  Calendar,
  Filter,
  Check,
  DollarSign,
  Tag,
  Mail,
  Lock,
  UserCircle,
  Shield,
  ShieldCheck,
  Bell,
  Clock,
  AlertCircle,
  CalendarClock,
  Coins,
  Edit2,
  Save,
  PlusCircle,
  Calculator,
  BrainCircuit,
  Lightbulb,
  Target,
  MessageSquare,
  FileText,
  ArrowRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Users,
  Crown,
  Trophy,
  Star,
  Smartphone,
  UploadCloud,
  LineChart,
  Quote,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  Send,
  Link,
  Landmark,
  ScanLine,
  ImageIcon,
  QrCode,
  Building,
  RotateCcw,
  CreditCard,
  Download,
  Upload,
  Copy,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  UserPlus
};

export const CheckCircleFilled = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={`icon icon-tabler icons-tabler-filled icon-tabler-circle-check ${className}`}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" />
  </svg>
);
