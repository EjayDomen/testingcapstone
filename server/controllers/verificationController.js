
const randomString = require('randomstring');
const nodeMailer = require('nodemailer');
const OtpCache = {};

function generateOTP() {
    const otp = randomString.generate({ length: 4, charset: 'numeric' });
    console.log('Generated OTP inside function:', otp); // Log the OTP directly
    return otp;
}


function sendOTP(email, otp) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'OTP Verification',
        text: `Your OTP for verification is: ${otp}`
    };

    // Configure the transport
    const transporter = nodeMailer.createTransport({
        service: 'Gmail', // Example service
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS, // Use environment variables for security
        },
    });

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Error:', error);
        }
        console.log('Email sent:', info.response);
    });

}


const sendEmailOtp = async (req, res) => {
    const { email } = req.body;
    const otp = generateOTP();
    console.log('Generated OTP:', otp);

    OtpCache[email] = otp;


    sendOTP(email, otp);
    res.cookie('otpCache', OtpCache, { maxAge: 30000, httpOnly: true });

    // For testing purposes, you can return the OTP in the response
    res.status(200).json({ message: 'OTP sent successfully', otp });
}
const verifyEmailOtp = async (req, res) => {
    const { email, otp } = req.body;

    if (!OtpCache.hasOwnProperty(email)) {
        return res.status(400).json({ message: 'Email not found' });
    }

    if (OtpCache[email] === otp.trim()) {

        delete OtpCache[email];
        return res.status(200).json({ message: "OTP verified successfully" })

    } else {
        return res.status(200).json({ message: "Invalid OTP" })
    }
}

const resendEmailOtp = async (req, res) => {
    const { email } = req.body;

    // Check if the OTP exists for this email
    if (!OtpCache.hasOwnProperty(email)) {
        return res.status(400).json({ message: 'OTP not found for this email. Please request a new OTP.' });
    }

    // Resend the existing OTP
    const otp = OtpCache[email];
    sendOTP(email, otp);
    console.log('Resent OTP:', otp);
    res.status(200).json({ message: 'OTP resent successfully' });
}

module.exports = {
    sendEmailOtp,
    verifyEmailOtp,
    resendEmailOtp,
};