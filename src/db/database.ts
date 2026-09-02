/**
 * Database: RelevaCadDatabase (IndexedDB via Dexie.js)
 * Sistema de almacenamiento local y persistencia offline para RelevaCAD,
 * estructurado con el mismo motor de datos que Cotizador IEBA.
 */

import Dexie, { type Table } from 'dexie';
import { RelevamientoProyecto, Cliente } from '@/models/ProjectModel';

export class RelevaCadDatabase extends Dexie {
  proyectos!: Table<RelevamientoProyecto, string>;
  clientes!: Table<Cliente, string>;
  activeSession!: Table<{ id: string; projectId: string; data: RelevamientoProyecto; updatedAt: string }, string>;

  constructor() {
    super('RelevaCadDB');

    this.version(1).stores({
      proyectos: 'id, nombre, clienteId, clienteNombre, estado, updatedAt',
      clientes: 'id, nombre, cuitDni, telefono, email, updatedAt',
      activeSession: 'id, projectId, updatedAt'
    });
  }
}

export const db = new RelevaCadDatabase();

/**
 * Guarda o actualiza un proyecto de relevamiento en IndexedDB.
 */
export async function saveProject(project: RelevamientoProyecto): Promise<string> {
  const updatedProject: RelevamientoProyecto = {
    ...project,
    updatedAt: new Date().toISOString()
  };
  await db.proyectos.put(updatedProject);
  return updatedProject.id;
}

/**
 * Retorna todos los proyectos ordenados por fecha de modificación descendente.
 */
export async function getAllProjects(): Promise<RelevamientoProyecto[]> {
  return await db.proyectos.orderBy('updatedAt').reverse().toArray();
}

/**
 * Obtiene un proyecto por su ID.
 */
export async function getProjectById(id: string): Promise<RelevamientoProyecto | undefined> {
  return await db.proyectos.get(id);
}

/**
 * Elimina un proyecto por su ID.
 */
export async function deleteProject(id: string): Promise<void> {
  await db.proyectos.delete(id);
}

/**
 * Guarda o actualiza un cliente.
 */
export async function saveClient(client: Cliente): Promise<string> {
  const updatedClient: Cliente = {
    ...client,
    updatedAt: new Date().toISOString()
  };
  await db.clientes.put(updatedClient);
  return updatedClient.id;
}

/**
 * Retorna todos los clientes agendados.
 */
export async function getAllClients(): Promise<Cliente[]> {
  return await db.clientes.orderBy('nombre').toArray();
}

/**
 * Guarda automáticamente la sesión de trabajo actual en IndexedDB.
 */
export async function autoSaveActiveSession(project: RelevamientoProyecto): Promise<void> {
  try {
    await db.activeSession.put({
      id: 'current_active_session',
      projectId: project.id,
      data: project,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[RelevaCadDB] Error al auto-guardar sesión:', err);
  }
}

/**
 * Recupera la última sesión activa guardada en IndexedDB.
 */
export async function loadActiveSession(): Promise<RelevamientoProyecto | null> {
  try {
    const session = await db.activeSession.get('current_active_session');
    return session ? session.data : null;
  } catch (err) {
    console.warn('[RelevaCadDB] Error al cargar sesión previa:', err);
    return null;
  }
}
