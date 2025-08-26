const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
    try {
        // Validate email format
        if (!to || typeof to !== 'string' || !to.includes('@')) {
            throw new Error('Invalid email address format');
        }

        const { data, error } = await resend.emails.send({
            from: 'Brand Appeal <onboarding@resend.dev>', // Using Resend's default domain for testing
            to: to, // Send as string, not array
            subject: subject,
            html: html,
        });

        if (error) {
            console.error('Resend error:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }

        console.log('Email sent successfully:', data);
        return data;
    } catch (error) {
        console.error('Email sending failed:', error);
        throw error;
    }
};

module.exports = sendEmail;