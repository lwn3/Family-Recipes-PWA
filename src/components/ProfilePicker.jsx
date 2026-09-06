import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'

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
    <main className="profile-page">
      <h1>Family Recipes</h1>
      <p>Choose your household.</p>

      <div className="profile-list">
        {profiles?.map((profile) => (
          <button
            key={profile.id}
            className="profile-card"
            onClick={() => chooseProfile(profile)}
          >
            {profile.name}
          </button>
        ))}
      </div>

      <section className="create-profile">
        <h2>Create Profile</h2>

        <input
          type="text"
          placeholder="Family or household name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') createProfile()
          }}
        />

        <button onClick={createProfile}>Create Profile</button>
      </section>
    </main>
  )
}

export default ProfilePicker