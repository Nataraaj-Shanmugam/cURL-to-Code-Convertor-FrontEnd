/**
 * Visibility of a row's Edit / Delete buttons (the row carries `group`): shown on hover, while
 * anything in the row has keyboard focus (so a focused button is never invisible), and always on
 * devices without hover (touch).
 */
export const ROW_ACTIONS_VISIBILITY =
  "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100";
