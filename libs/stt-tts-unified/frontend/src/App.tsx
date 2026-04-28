import { ThemeProvider } from './context/ThemeContext'
import AppShell from './components/Layout/AppShell'

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}
