import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp, Check, CheckCircle2, ChevronDown, Eye, EyeOff, Filter, Info, Package, Pencil, Plus, Search, Star, Trash2, Upload, X } from 'lucide-react';

// Một bộ icon duy nhất (lucide-react); tên theo design system. Thêm icon mới vào map này.
const icons = { 'alert-circle': AlertCircle, 'alert-triangle': AlertTriangle, 'arrow-down': ArrowDown, 'arrow-up': ArrowUp, check: Check, 'check-circle': CheckCircle2, 'chevron-down': ChevronDown, edit: Pencil, eye: Eye, 'eye-off': EyeOff, filter: Filter, info: Info, package: Package, plus: Plus, search: Search, star: Star, trash: Trash2, upload: Upload, x: X };

export function Icon({ name, size = 20, ...rest }) {
  const Glyph = icons[name];
  return Glyph ? <Glyph size={size} strokeWidth={2} aria-hidden="true" style={{ flex: 'none' }} {...rest} /> : null;
}
