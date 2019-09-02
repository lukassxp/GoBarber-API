import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore } from 'date-fns';

import User from '../models/User';
import Appointment from '../models/Appointment';

class AppointmentController {
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

    return res.json(appointment);
  }
}

export default new AppointmentController();
