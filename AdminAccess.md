How to Assign Admin and Moderator Roles
User roles are managed directly in your Firebase Firestore database. There is no public-facing UI to change a user's role for security reasons.

To assign a role:

Go to your Firebase Console.

Navigate to Firestore Database.

Find the users collection.

Locate the document for the user you want to grant privileges to. The document ID is the user's uid.

Inside that user's document, add a new field with the key role.

Set the value of the role field to one of the following strings:

"admin" for full administrative privileges.

"moderator" for privileges to add and edit questions.

The user will gain their new role the next time they log in or refresh the application.

How the System Identifies Roles
Authentication: When a user logs in, the AuthContext fetches their user document from the users collection in Firestore using their unique UID.

Role Check: The application code, particularly in the Navbar and AdminPanel components, checks the role field from the user's profile data (userInfo).

Conditional Rendering:

If userInfo.role is 'admin' or 'moderator', the "Admin Panel" link appears in the navigation bar.

The AdminPanel page itself renders different views based on the role. An admin sees the verification queue, while a moderator sees their submitted questions and an option to add more.

Regular users (with role set to 'user' or no role field) will not see the admin link and will be redirected if they try to access the /admin URL directly.

The Practice page only shows questions where verified is true for regular users, but admins and moderators can see all questions.

This approach ensures that role-based access is controlled securely on the backend (Firestore) and the frontend responds accordingly.