import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST as string,
    port: Number(process.env.EMAIL_PORT),
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER as string, 
        pass: process.env.EMAIL_PASS as string,
    },
});

export async function sendTemporaryPasswordEmail(to: string, name: string, tempPassword: string) {
    try {
        const mailOptions = {
            from: `"Equipe da Plataforma" <${process.env.EMAIL_SENDER}>`, 
            to, 
            subject: "Bem-vindo! Seu acesso foi liberado", 
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Olá, ${name}!</h2>
                    <p>Sua conta foi criada com sucesso pela nossa equipe.</p>
                    <p>Para o seu primeiro acesso, utilize a senha provisória abaixo:</p>
                    <h3 style="background-color: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">
                        ${tempPassword}
                    </h3>
                    <p><em>Por questões de segurança, recomendamos que você altere esta senha assim que fizer o login.</em></p>
                    <br/>
                    <p>Atenciosamente,<br/>Equipe Técnica</p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email enviado com sucesso para ${to} (ID: ${info.messageId})`);
    } catch (error) {
        console.error("Erro ao enviar email:", error);
        throw new Error("Não foi possível enviar o email com a senha temporária.", { cause: error });
    }
}