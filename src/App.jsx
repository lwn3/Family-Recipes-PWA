import { useEffect, useState } from 'react'
import { db } from './db/database'
import ProfilePicker from './components/ProfilePicker'
import AppShell from './components/AppShell'
import './components/ButtonTheme.css'

function App() {
  const [activeProfile, setActiveProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState('home')

  useEffect(() => {
    async function loadProfile() {
      const savedId = localStorage.getItem('activeProfileId')

      if (savedId) {
        const profile = await db.profiles.get(Number(savedId))

        if (profile) {
          setActiveProfile(profile)
        } else {
          localStorage.removeItem('activeProfileId')
        }
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  function handleProfileSelected(profile) {
    setActiveProfile(profile)
    setCurrentView('home')
  }

  function handleSwitchProfile() {
    localStorage.removeItem('activeProfileId')
    setActiveProfile(null)
  }

  if (loading) {
    return <main>Loading...</main>
  }

  if (!activeProfile) {
    return (
      <ProfilePicker
        onProfileSelected={handleProfileSelected}
      />
    )
  }

  return (
    <AppShell
      activeProfile={activeProfile}
      currentView={currentView}
      onViewChange={setCurrentView}
      onSwitchProfile={handleSwitchProfile}
    />
  )
}

export default App
