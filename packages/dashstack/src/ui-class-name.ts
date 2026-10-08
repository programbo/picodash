/**
 * Keep each public control's structural hook while allowing a caller-owned
 * class to target the same root element.
 */
export function composeControlClassName(structuralClassName: string, className?: string): string {
  return className ? `${structuralClassName} ${className}` : structuralClassName
}
