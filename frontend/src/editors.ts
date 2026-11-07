// The editors list (#7): who may change the plan. The backend keeps it and refuses changes from anyone else; these
// helpers are the settings dialog's logic.

/** A Home Assistant user as `home_3d/editors/get` lists them. */
export interface EditorUser {
  id: string;
  name: string;
  is_admin: boolean;
  editor: boolean;
}

/** The editors after ticking (on) or unticking one user. */
export function pickEditor(users: EditorUser[], id: string, on: boolean): string[] {
  return users.filter((u) => (u.id === id ? on : u.editor)).map((u) => u.id);
}

/** This user is the only admin left on the list: unticking them is refused (someone must be able to change it). */
export function lastAdmin(users: EditorUser[], id: string): boolean {
  const admins = users.filter((u) => u.is_admin && u.editor);
  return admins.length === 1 && admins[0].id === id;
}

/** The users whose panel opens in locked tablet mode (#92, `settings.tablet_users`) after ticking or unticking one. */
export function pickTabletUser(list: readonly string[] | undefined, id: string, on: boolean): string[] {
  const rest = (list ?? []).filter((u) => u !== id);
  return on ? [...rest, id] : rest;
}

/** One row of a user list (the searchable multi-select of the editors and the wall tablets, #227). */
export interface UserChoice {
  id: string;
  label: string;
  /** Small text after the name ("admin"). */
  note?: string;
  /** A user with no person attached (a service user, an integration's account): behind the list's toggle. */
  secondary: boolean;
}

/** The Home Assistant users that have a person attached: a person entity's `user_id` names them. */
export function personUserIds(states: Record<string, { attributes?: Record<string, unknown> }> | undefined): Set<string> {
  const ids = new Set<string>();
  for (const [id, st] of Object.entries(states ?? {})) {
    const uid = id.startsWith("person.") ? st?.attributes?.user_id : null;
    if (typeof uid === "string" && uid) ids.add(uid);
  }
  return ids;
}

/**
 * The users as list rows: real people first (admins before the rest, then by name), service users (no person
 * attached) last and marked `secondary`. Home Assistant without any person entity cannot tell, so nobody is a service user then.
 */
export function userChoices(users: readonly EditorUser[], persons: ReadonlySet<string>, adminNote = "admin"): UserChoice[] {
  const known = users.some((u) => persons.has(u.id));
  const name = (u: EditorUser) => u.name || u.id;
  return users
    .map((u) => ({ u, secondary: known && !persons.has(u.id) }))
    .sort((a, b) => Number(a.secondary) - Number(b.secondary) || Number(b.u.is_admin) - Number(a.u.is_admin) || name(a.u).localeCompare(name(b.u)))
    .map(({ u, secondary }) => ({ id: u.id, label: name(u), note: u.is_admin ? adminNote : undefined, secondary }));
}
