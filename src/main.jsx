import React from 'react'
import ReactDOM from 'react-dom/client'
import RouterApp from './RouterApp.jsx'
import './index.css'
import './styles.css'
import { AuthProvider } from './contexts/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterApp />
    </AuthProvider>
  </React.StrictMode>,
)
