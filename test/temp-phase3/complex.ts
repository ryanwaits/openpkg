
          /**
           * User management service
           * @since 2.0.0
           */
          export class UserService {
            private users = new Map<string, User>();
            
            /**
             * Add a new user
             * @param user The user to add
             * @returns The user ID
             */
            addUser(user: User) {
              const id = crypto.randomUUID();
              this.users.set(id, user);
              return id;
            }
            
            /**
             * Find a user by ID
             * @param id The user ID
             * @returns The user if found
             */
            findUser(id: string): User | undefined {
              return this.users.get(id);
            }
          }
          
          interface User {
            name: string;
            email: string;
            role: 'admin' | 'user';
          }
        