import React from 'react'
import ReactDOM from 'react-dom/client'
import { Notifications } from '@mantine/notifications'
import { BrowserRouter } from 'react-router-dom'

import { App } from './app/App'
import './tailwind.css'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { ThemeProvider } from './theme/ThemeProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Notifications position="top-right" />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)


