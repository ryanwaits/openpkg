/**
 * A user in the system
 */
export interface User {
  id: string;
  name: string;
  email: string;
  profile: UserProfile;
}

export interface UserProfile {
  bio: string;
  avatar?: string;
  preferences: Preferences;
}

export type Preferences = {
  theme: 'light' | 'dark';
  notifications: boolean;
};

/**
 * Creates a new user
 * @param userData Initial user data
 * @returns The created user
 */
export function createUser(userData: Partial<User>): User {
  return {
    id: Date.now().toString(),
    name: userData.name || 'Anonymous',
    email: userData.email || '',
    profile: userData.profile || {
      bio: '',
      preferences: {
        theme: 'light',
        notifications: true
      }
    }
  };
}

/**
 * Updates user preferences
 */
export function updatePreferences(user: User, prefs: Partial<Preferences>): User {
  return {
    ...user,
    profile: {
      ...user.profile,
      preferences: {
        ...user.profile.preferences,
        ...prefs
      }
    }
  };
}