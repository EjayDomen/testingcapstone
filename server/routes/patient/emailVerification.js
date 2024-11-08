const express = require('express');


const randomString = require('randomstring');
const nodeMailer = require('nodemailer');
const bcrypt = require('bcryptjs');




const router = express.Router();

const OtpCache = {};

function generateOTP() {
    const otp = randomString.generate({ length: 4, charset: 'numeric' });
    console.log('Generated OTP inside function:', otp); // Log the OTP directly
    return otp;
}



async function sendOTP(email, otp) {
    try {
        // Configure the transporter
        const transporter = nodeMailer.createTransport({
            service: 'Gmail', // Example service
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, // Use environment variables for security
            },
        });

        // Define email options
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'OTP Verification',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
                    <h2 style="text-align: center; color: #4CAF50;">OTP Verification</h2>
                    <p>Dear User,</p>
                    <p>Thank you for using our service. Please use the following One-Time Password (OTP) to complete your verification process:</p>
                    <div style="text-align: center; margin: 20px 0; font-size: 24px; font-weight: bold; color: #333;">
                        ${otp}
                    </div>
                    <p style="color: #555;">This OTP is valid for 10 minutes. Please do not share this code with anyone for security reasons.</p>
                    <hr style="border: none; border-top: 1px solid #ddd;">
                    <p style="font-size: 12px; text-align: center; color: #888;">If you did not request this OTP, please ignore this email or contact support if you have any concerns.</p>
                </div>
            `,
        };

        // Send the email
        const info = await transporter.sendMail(mailOptions);

        console.log(`OTP sent to ${email}: ${info.response}`);
        return true; // Return success status
    } catch (error) {
        console.error('Error sending OTP:', error);
        return false; // Return failure status
    }
}

// Route to handle sending OTP
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;

    try {
        // Step 1: Generate a new OTP
        const otp = generateOTP();
        console.log('Generated OTP:', otp);

        // Step 2: Hash the OTP before storing it in the cache
        const otpHash = await bcrypt.hash(otp, 10);

        // Step 3: Store the hashed OTP and timestamp in the cache
        OtpCache[email] = { otpHash, createdAt: Date.now() };

        // Step 4: Send the plain OTP to the user's email (do not send the hash)
        sendOTP(email, otp);

        // Respond with success (no plain OTP should be included in the response)
        res.status(200).json({ message: 'OTP sent successfully.' });
    } catch (error) {
        console.log('Error sending OTP:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});



router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        const otpData = OtpCache[email];

        if (!otpData) {
            return res.status(400).json({ message: 'OTP not found or expired.' });
        }

        const { otpHash, createdAt } = otpData;

        // Verify the OTP using bcrypt
        const isMatch = await bcrypt.compare(otp, otpHash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
        }

        // Check if OTP is expired (optional)
        const isExpired = (Date.now() - createdAt) > 5 * 60 * 1000; // 5 minutes in milliseconds
        if (isExpired) {
            delete OtpCache[email]; // Remove expired OTP
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        // If OTP is valid and not expired, delete from cache and confirm success
        delete OtpCache[email];
        res.status(200).json({ message: 'OTP verified successfully.' });
    } catch (error) {
        console.log('Error verifying OTP:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Existing code...

// Endpoint to resend OTP
// Endpoint to resend OTP
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;

    console.log("Current OtpCache:", OtpCache); // Log cache contents before check
    // Check if the OTP exists for this email
    if (OtpCache.hasOwnProperty(email)) {
        return res.status(400).json({ message: 'OTP not found for this email. Please request a new OTP.' });
    }

    // Generate a new OTP
    const newOtp = generateOTP(); // Generate a new OTP
    const otpHash = await bcrypt.hash(newOtp, 10); // Hash the new OTP

    // Update the OTPCache with the new OTP hash
    OtpCache[email] = { otpHash, createdAt: Date.now() };

    // Send the new OTP
    sendOTP(email, newOtp); // Send the plain new OTP
    console.log('Resent OTP:', newOtp); // Log the newly generated OTP

    res.status(200).json({ message: 'OTP resent successfully.' });
});




module.exports = router;



