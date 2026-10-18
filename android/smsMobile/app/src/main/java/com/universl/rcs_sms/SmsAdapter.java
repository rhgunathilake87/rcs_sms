package com.universl.rcs_sms;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.text.DateFormat;
import java.util.Date;
import java.util.List;

public class SmsAdapter extends RecyclerView.Adapter<SmsAdapter.SmsViewHolder> {

    public interface OnVerifyClickListener {
        void onVerify(SmsItem sms);
    }

    private final List<SmsItem> messages;
    private final OnVerifyClickListener listener;

    public SmsAdapter(
            List<SmsItem> messages,
            OnVerifyClickListener listener
    ) {
        this.messages = messages;
        this.listener = listener;
    }

    @NonNull
    @Override
    public SmsViewHolder onCreateViewHolder(
            @NonNull ViewGroup parent, int viewType) {

        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_sms, parent, false);

        return new SmsViewHolder(view);
    }

    @Override
    public void onBindViewHolder(
            @NonNull SmsViewHolder holder, int position) {

        SmsItem sms = messages.get(position);

        holder.sender.setText(
                sms.getSender() == null ? "Unknown sender" : sms.getSender()
        );

        holder.body.setText(sms.getBody());

        holder.date.setText(
                DateFormat.getDateTimeInstance()
                        .format(new Date(sms.getTimestamp()))
        );

        holder.status.setText(sms.getVerificationStatus());

        boolean hasInstitution =
                !sms.getInstitutionName().isEmpty()
                        || !sms.getInstitutionId().isEmpty();

        holder.institutionName.setText(
                "Institution: " + sms.getInstitutionName()
        );
        holder.institutionId.setText(
                "Institution ID: " + sms.getInstitutionId()
        );
        holder.institutionVerified.setText(
                sms.isInstitutionVerified()
                        ? "Institution verified: Yes"
                        : "Institution verified: No"
        );
        holder.institutionLogoUrl.setText(
                "Logo URL: " + sms.getInstitutionLogoUrl()
        );

        int visibility = hasInstitution ? View.VISIBLE : View.GONE;

        holder.institutionName.setVisibility(visibility);
        holder.institutionId.setVisibility(visibility);
        holder.institutionVerified.setVisibility(visibility);

        holder.institutionLogoUrl.setVisibility(
                sms.getInstitutionLogoUrl().isEmpty()
                        ? View.GONE
                        : View.VISIBLE
        );

        boolean checking = "CHECKING".equals(
                sms.getVerificationStatus()
        );

        holder.verifyButton.setEnabled(!checking);
        holder.verifyButton.setText(
                checking ? "Checking..." : "Verify message"
        );

        holder.verifyButton.setOnClickListener(v -> {
            int currentPosition = holder.getBindingAdapterPosition();

            if (currentPosition != RecyclerView.NO_POSITION) {
                listener.onVerify(messages.get(currentPosition));
            }
        });
    }

    @Override
    public int getItemCount() {
        return messages.size();
    }

    static class SmsViewHolder extends RecyclerView.ViewHolder {
        TextView sender;
        TextView body;
        TextView date;
        TextView status;
        Button verifyButton;
        TextView institutionName;
        TextView institutionId;
        TextView institutionVerified;
        TextView institutionLogoUrl;

        SmsViewHolder(@NonNull View itemView) {
            super(itemView);

            sender = itemView.findViewById(R.id.smsSender);
            body = itemView.findViewById(R.id.smsBody);
            date = itemView.findViewById(R.id.smsDate);
            status = itemView.findViewById(R.id.smsStatus);
            verifyButton = itemView.findViewById(R.id.verifySmsButton);
            institutionName = itemView.findViewById(R.id.institutionName);
            institutionId = itemView.findViewById(R.id.institutionId);
            institutionVerified = itemView.findViewById(R.id.institutionVerified);
            institutionLogoUrl = itemView.findViewById(R.id.institutionLogoUrl);
        }
    }
}
