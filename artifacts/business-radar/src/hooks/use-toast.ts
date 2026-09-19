import { ReactNode, useState, useEffect } from 'react';

export const ToastProvider = ({ children }: { children: ReactNode }) => children;
export const ToastViewport = () => null;
export const Toast = () => null;
export const ToastTitle = () => null;
export const ToastDescription = () => null;
export const ToastClose = () => null;
export const ToastAction = () => null;
export const Toaster = () => null;

let memoryState: any[] = [];
let listeners: any[] = [];

export function toast(t: any) {
  memoryState = [...memoryState, { id: Date.now(), ...t }];
  listeners.forEach(l => l(memoryState));
}

export function useToast() {
  const [toasts, setToasts] = useState<any[]>(memoryState);
  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter(l => l !== setToasts);
    };
  }, []);
  return { toasts, toast };
}