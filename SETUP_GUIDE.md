# TaskFlow Setup Guide

This guide explains how to install, configure, and run TaskFlow on a Windows computer.

## 1. Prerequisites

Before setting up TaskFlow, ensure you have:

- Windows operating system
- Python installed
- A web browser (Chrome, Edge, Firefox, etc.)
- The TaskFlow project files

## 2. Download and Extract the Project

1. Download the TaskFlow project ZIP file.
2. Extract the ZIP file to a location on your computer.
3. Open the extracted TaskFlow folder.

Ensure that you are inside the main project folder containing the setup and startup batch files.

## 3. Run the Setup Script

1. Locate `SETUP_TASKFLOW.bat`.
2. Double-click the file to run it.
3. The setup script will create the required Python environment and install the necessary dependencies.
4. When the environment configuration file opens in Notepad, proceed to the next step.

## 4. Configure Environment Variables

The application requires environment configuration before it can be started.

### Generate a JWT Secret

1. Open PowerShell.
2. Run the following command:

   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

3. Copy the generated value.
4. Paste it into the `JWT_SECRET` field in the `.env` file.

### Configure Master Admin Credentials

Set the Master Admin email address and password using the corresponding fields in the `.env` file.

These credentials will be used to access the Master Admin account.

**Important:** Keep your `.env` file private. Do not upload it to GitHub or share it publicly.

5. Save the `.env` file.
6. Close Notepad.

## 5. Start TaskFlow

1. Locate `START_TASKFLOW.bat`.
2. Double-click the file.
3. The frontend and backend servers will start in their respective terminal windows.
4. Keep these terminal windows open while using the application.

Closing the terminal windows will stop the application servers.

## 6. Access the Application

Open your web browser and navigate to:

**Frontend:**  
http://localhost:5500/index.html

**Backend API Documentation:**  
http://127.0.0.1:8000/docs

The backend documentation page can be used to view and interact with the API endpoints.

## 7. User Registration and Login

1. Open the TaskFlow application.
2. Navigate to the User Registration page.
3. Enter the required registration details.
4. Submit the registration form.
5. Log in using your registered credentials.

Users can access their task management dashboard after successful authentication.

## 8. Administrator Access

Administrator accounts require approval from the Master Admin.

### Request Administrator Access

1. Navigate to the Admin Registration page.
2. Submit the administrator access request.
3. The request will remain pending until approved by the Master Admin.

### Approve an Administrator Request

1. Log in using the Master Admin credentials configured during setup.
2. Navigate to the administrator request management section.
3. Review the pending administrator request.
4. Approve or reject the request.

### OTP Verification

OTP verification is implemented for the administrator approval workflow.

When the Master Admin approves a new administrator request, the generated OTP is displayed as part of the approval process.

Since automated email delivery has not been implemented:

1. The Master Admin must note down the generated OTP during approval.
2. The OTP must be manually communicated to the requesting administrator.
3. The requesting administrator enters the OTP to complete the verification process.

After successful verification, the administrator can proceed with accessing their account.

**Note:** OTP verification functionality is implemented, but automatic email delivery is not currently available.

## 9. Stopping the Application

When you are finished using TaskFlow:

1. Close the frontend server terminal.
2. Close the backend server terminal.

This will stop the application servers.

## 10. Troubleshooting

### The application does not open

- Ensure that `START_TASKFLOW.bat` has been executed.
- Check that both server terminal windows are running.
- Try opening the application using `http://localhost:5500/index.html`.

### The backend is not responding

- Check whether the backend terminal is still running.
- Open the API documentation page at `http://127.0.0.1:8000/docs`.
- If the server has stopped, restart the application using `START_TASKFLOW.bat`.

### Setup fails

- Ensure Python is installed correctly.
- Check that the setup script has completed its execution.
- Review any error messages displayed in the terminal.

### The application stops unexpectedly

If the application or computer shuts down unexpectedly, the frontend and backend servers will need to be started again using `START_TASKFLOW.bat`.

## 11. Security Notes

- Do not share your `.env` file.
- Do not upload secret keys, passwords, or private credentials to GitHub.
- Use test credentials when evaluating the application.
- TaskFlow is currently intended for demonstration and testing purposes.
- Real email communication and handling of sensitive information require additional security measures before production deployment.

---

**TaskFlow — Setup and Usage Guide**