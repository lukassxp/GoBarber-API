import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';

import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';

import Notification from '../schemas/Notification';

import Mail from '../../lib/Mail';

class AppointmentController {
  async index(req, res) {
    const user_id = req.userId;
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            { model: File, as: 'avatar', attributes: ['id', 'path', 'url'] },
          ],
        },
      ],
    });

    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.validate(req.body))) {
      return res
        .status(400)
        .json({ error: 'Body of request out of expected format' });
    }

    const { provider_id, date } = req.body;
    const user_id = req.userId;

    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res.status(401).json({ error: 'This provider does not exists!' });
    }

    const startHour = startOfHour(parseISO(date));

    if (isBefore(startHour, new Date())) {
      return res.status(400).json({ error: 'Past dates are not permited!' });
    }

    const checkAvaliability = await Appointment.findOne({
      where: { provider_id, date: startHour, canceled_at: null },
    });

    if (checkAvaliability) {
      return res
        .status(400)
        .json({ error: 'Appointment date is not avaliable!' });
    }

    const appointment = await Appointment.create({
      user_id,
      provider_id,
      date,
    });

    const { name: userName } = await User.findByPk(user_id);
    const formatedDate = format(startHour, "'dia' dd 'de' MMMM', às' H:mm'h'", {
      locale: pt,
    });

    await Notification.create({
      content: `Novo agendamento de ${userName} para ${formatedDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const { userId } = req;
    const { id: appointmentId } = req.params;

    const appointment = await Appointment.findByPk(appointmentId, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (userId !== appointment.user_id) {
      return res.status(401).json({
        error: "You don't have permission to cancel this appointment!",
      });
    }

    const dateWithSub = subHours(appointment.date, 2);

    if (isBefore(dateWithSub, new Date())) {
      return res.status(401).json({
        error: 'You can only cancel appointments 2 hours in advance!',
      });
    }

    appointment.canceled_at = new Date();
    await appointment.save();

    await Mail.sendMail({
      to: `${appointment.provider.name} <${appointment.provider.email}>`,
      subject: 'Agendamento cancelado!',
      template: 'cancelation',
      context: {
        provider: appointment.provider.name,
        user: appointment.user.name,
        date: format(appointment.date, "'dia' dd 'de' MMMM', às' H:mm'h'", {
          locale: pt,
        }),
      },
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
