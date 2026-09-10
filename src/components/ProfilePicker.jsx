import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import './VisualPolish.css'

function ProfilePicker({ onProfileSelected }) {
  const profiles = useLiveQuery(() => db.profiles.toArray(), [])
  const [name, setName] = useState('')

  async function createProfile() {
    const trimmedName = name.trim()
    if (!trimmedName) return

    const now = new Date().toISOString()

    const id = await db.profiles.add({
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
    })

    const profile = await db.profiles.get(id)
    localStorage.setItem('activeProfileId', String(id))
    onProfileSelected(profile)
    setName('')
  }

  function chooseProfile(profile) {
    localStorage.setItem('activeProfileId', String(profile.id))
    onProfileSelected(profile)
  }

  return (
    <main className="profile-page polished-profile-page">
      <section className="profile-welcome-card">
        <img
          className="profile-app-icon"
          src="/pwa-192x192.png"
          alt="Family Recipes"
        />

        <div>
          <p className="eyebrow">Welcome to</p>
          <h1>Family Recipes</h1>
          <p className="profile-welcome-copy">
            Choose your household or create a new one to get cooking.
          </p>
        </div>

        {profiles?.length > 0 && (
          <div className="profile-list polished-profile-list">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                className="profile-card polished-profile-card"
                onClick={() => chooseProfile(profile)}
              >
                <span className="profile-card-avatar">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
                <span>{profile.name}</span>
              </button>
            ))}
          </div>
        )}

        <section className="create-profile polished-create-profile">
          <h2>{profiles?.length ? 'Create another household' : 'Create your household'}</h2>

          <div className="create-profile-row">
            <input
              type="text"
              placeholder="Family or household name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') createProfile()
              }}
            />

            <button
              className="primary-button"
              onClick={createProfile}
            >
              Create Profile
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}

export default ProfilePicker
