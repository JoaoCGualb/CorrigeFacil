import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'CorrigeFácil · Avaliações', description: 'Suas avaliações, da primeira resposta à próxima aprendizagem.' };
export default function Layout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR"><body>{children}</body></html>}
