/**
 * ViewModel Hook: useKeyboardShortcuts
 * Centraliza la captura de atajos de teclado para operaciones ultra-rápidas en escritorio:
 * - 1, 2, 3: Cambio de fases (Topología, Parametrización, Ensamblaje)
 * - A / N: Agregar nuevo ambiente / límite
 * - S: Alternar Snap Magnético
 * - Espacio / E: Auto-Ensamblar o Parametrizar
 * - Tab / Shift+Tab: Ciclar entre ambientes
 * - Supr / Backspace: Eliminar ambiente seleccionado
 * - Ctrl+S / Cmd+S: Guardar proyecto en base de datos local
 * - ?: Abrir modal de ayuda de atajos
 */

import { useEffect, useCallback } from 'react';
import { useSurveyViewModel } from './useSurveyViewModel';

interface KeyboardShortcutsOptions {
  onOpenAddRoom: () => void;
  onOpenShortcutsHelp: () => void;
  onOpenProjectDialog: () => void;
}

export function useKeyboardShortcuts({
  onOpenAddRoom,
  onOpenShortcutsHelp,
  onOpenProjectDialog
}: KeyboardShortcutsOptions) {
  const {
    activePhase,
    setActivePhase,
    rooms,
    selectedRoomId,
    selectedRoom,
    selectRoom,
    deleteRoom,
    autoAssembleRooms,
    toggleSnap,
    saveCurrentProjectToDB
  } = useSurveyViewModel();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Si el usuario está escribiendo en un campo de texto, no interceptar
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        // Permitir Ctrl+S / Cmd+S dentro de inputs
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          saveCurrentProjectToDB();
        }
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Guardado Manual (Ctrl+S / Cmd+S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentProjectToDB();
        return;
      }

      // Atajos de 1 sola tecla
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        // 1. Cambio de fase
        if (e.key === '1') {
          e.preventDefault();
          setActivePhase('architecture');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          setActivePhase('electrical');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          setActivePhase('presentation');
          return;
        }

        // 2. Creación de ambiente / límite (A o N)
        if (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'n') {
          e.preventDefault();
          onOpenAddRoom();
          return;
        }

        // 3. Snap Magnético (S)
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          toggleSnap();
          return;
        }

        // 4. Auto-Alinear y Centrar (Espacio o E)
        if (e.key === ' ' || e.key.toLowerCase() === 'e') {
          e.preventDefault();
          autoAssembleRooms();
          return;
        }

        // 5. Ayuda de atajos (? o F1 o H)
        if (e.key === '?' || e.key === 'F1' || e.key.toLowerCase() === 'h') {
          e.preventDefault();
          onOpenShortcutsHelp();
          return;
        }

        // 6. Deseleccionar (Escape)
        if (e.key === 'Escape') {
          e.preventDefault();
          selectRoom('');
          return;
        }

        // 7. Eliminar ambiente seleccionado (Delete / Supr)
        if (e.key === 'Delete') {
          if (selectedRoom) {
            e.preventDefault();
            deleteRoom(selectedRoom.id);
          }
          return;
        }

        // 8. Navegación secuencial entre ambientes (Tab / Shift+Tab)
        if (e.key === 'Tab') {
          e.preventDefault();
          if (rooms.length === 0) return;
          const currentIndex = rooms.findIndex((r) => r.id === selectedRoomId);
          let nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
          if (nextIndex >= rooms.length) nextIndex = 0;
          if (nextIndex < 0) nextIndex = rooms.length - 1;
          selectRoom(rooms[nextIndex].id);
          return;
        }

        // 9. Abrir Ficha de Proyecto (P)
        if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          onOpenProjectDialog();
          return;
        }
      }
    },
    [
      activePhase,
      setActivePhase,
      rooms,
      selectedRoomId,
      selectedRoom,
      selectRoom,
      deleteRoom,
      autoAssembleRooms,
      toggleSnap,
      saveCurrentProjectToDB,
      onOpenAddRoom,
      onOpenShortcutsHelp,
      onOpenProjectDialog
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
