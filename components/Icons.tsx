
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
  UserPlus,
  Phone,
  Flame,
  Percent,
  ExternalLink,
  Loader2,
  History,
  Bold,
  Italic,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Eye,
  Underline,
  Strikethrough,
  List,
  Code,
  Bug,
  ThumbsUp,
  Ban,
  Map,
  Hammer,
  Ticket,
  MessageSquarePlus
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
  Map,
  Hammer,
  CreditCard,
  Download,
  Upload,
  Copy,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  UserPlus,
  Phone,
  Flame,
  Percent,
  ExternalLink,
  Loader2,
  History,
  Bold,
  Italic,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Eye,
  Underline,
  Strikethrough,
  List,
  Code,
  Bug,
  ThumbsUp,
  Ban,
  Ticket,
  MessageSquarePlus
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
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" />
  </svg>
);

export const MathMaxMin = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`icon icon-tabler icons-tabler-outline icon-tabler-math-max-min ${className}`}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M15 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
    <path d="M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
    <path d="M3 14s.605 -5.44 2.284 -7.862m3.395 .026c2.137 2.652 4.547 9.113 6.68 11.719" />
    <path d="M18.748 18.038c.702 -.88 1.452 -3.56 2.252 -8.038" />
  </svg>
);

export const SidebarWallet = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`icon icon-tabler icons-tabler-outline icon-tabler-wallet ${className}`}><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" /><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" /></svg>
);

export const Pig = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`icon icon-tabler icons-tabler-outline icon-tabler-pig ${className}`}><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M15 11v.01" /><path d="M16 3l0 3.803a6.019 6.019 0 0 1 2.658 3.197h1.341a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-1.342a6.008 6.008 0 0 1 -1.658 2.473v2.027a1.5 1.5 0 0 1 -3 0v-.583a6.04 6.04 0 0 1 -1 .083h-4a6.04 6.04 0 0 1 -1 -.083v.583a1.5 1.5 0 0 1 -3 0v-2l0 -.027a6 6 0 0 1 4 -10.473h2.5l4.5 -3z" /></svg>
);
export const LinkIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`icon icon-tabler icons-tabler-outline icon-tabler-link ${className}`}><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg>
);

export const AnimatedClock = ({ size = 14, className = "" }: { size?: number, className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="6" x2="12" y2="12" className="origin-center animate-[spin_3s_linear_infinite]" /> {/* Minute hand */}
    <line x1="12" y1="12" x2="16" y2="12" className="origin-center animate-[spin_12s_linear_infinite]" /> {/* Hour hand */}
  </svg>
);
